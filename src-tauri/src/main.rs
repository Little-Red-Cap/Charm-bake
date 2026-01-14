// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use fontdue::{Font, FontSettings};
use font_kit::source::SystemSource;
use font_kit::handle::Handle;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "mode")]
enum FontSource {
  #[serde(rename = "system")]
  System { family: String },
  #[serde(rename = "file")]
  File { path: String },
}

#[derive(Debug, Serialize, Deserialize)]
struct Range {
  start: u32,
  end: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct FontJob {
  source: FontSource,
  #[serde(default)]
  module_name: String,
  size_px: u32,
  range: Range,
  custom_chars: Option<String>,
  fallback_char: Option<String>,
  output_kind: String,
  export_name: String,
  with_comments: bool,
  number_format: String,
}

#[derive(Debug, Serialize)]
struct GeneratedResult {
  ok: bool,
  warnings: Vec<String>,
  stats: GeneratedStats,
  preview: Option<GeneratedPreview>,
  c: Option<GeneratedC>,
}

#[derive(Debug, Serialize)]
struct GeneratedStats {
  glyph_count: u32,
  bytes: u32,
  max_w: u32,
  max_h: u32,
  line_height: i32,
  baseline: i32,
}

#[derive(Debug, Serialize)]
struct GeneratedPreview {
  glyphs: Vec<PreviewGlyph>,
}

#[derive(Debug, Serialize)]
struct PreviewGlyph {
  codepoint: u32,
  w: u32,
  h: u32,
  advance: u32,
  bitmap_b64: String,
}

#[derive(Debug, Serialize)]
struct GeneratedC {
  header: String,
  source: String,
}

struct PackedGlyph {
  codepoint: u32,
  offset: usize,
  len: usize,
}

#[derive(Clone, Copy)]
struct GlyphEntry {
  offset: usize,
  width: i32,
  height: i32,
  x_advance: i32,
  x_offset: i32,
  y_offset: i32,
}

struct GlyphRangeEntry {
  start: u32,
  length: u16,
  glyph_id_start: u16,
}

struct GlyphData {
  bitmaps: Vec<u8>,
  packed_glyphs: Vec<PackedGlyph>,
  glyphs: Vec<GlyphEntry>,
  codepoints: Vec<u32>,
  ranges: Vec<GlyphRangeEntry>,
  fallback_index: Option<usize>,
  max_w: u32,
  max_h: u32,
}

#[derive(Debug, Serialize)]
struct SystemFontInfo {
  family: String,
  path: String,
}

#[derive(Debug, Serialize)]
struct ExportResult {
  ok: bool,
  warnings: Vec<String>,
  output_path: Option<String>,
}

const PREVIEW_MAX_GLYPHS: usize = 256;
const PREVIEW_MAX_PIXELS_TOTAL: usize = 4 * 1024 * 1024; // 4MB raw grayscale
const PACK_THRESHOLD: u8 = 128;

#[tauri::command]
fn generate_font(job: FontJob) -> Result<GeneratedResult, String> {
  let _font = load_font_from_source(&job.source)?;

  if job.range.start > job.range.end {
    return Err("Invalid range: start must be <= end".to_string());
  }

  let (codepoint_map, mut warnings) = collect_codepoints(&job, &_font);
  let fallback_cp = job
    .fallback_char
    .as_deref()
    .and_then(|s| s.trim().chars().next())
    .map(|c| c as u32);
  let glyph_data = build_glyph_data(&_font, job.size_px, &codepoint_map, fallback_cp);
  let (glyphs, preview_truncated) = build_preview(&_font, job.size_px, &codepoint_map);
  if let Some((count, bytes)) = preview_truncated {
    warnings.push(format!("Preview truncated (glyphs={}, bytes={})", count, bytes));
  }

  let (line_height, baseline) = line_metrics(&_font, job.size_px);
  let cpp_module = generate_cpp_module(&job, &glyph_data, line_height, baseline);

  Ok(GeneratedResult {
    ok: true,
    warnings,
    stats: GeneratedStats {
      glyph_count: glyph_data.glyphs.len() as u32,
      bytes: glyph_data.bitmaps.len() as u32,
      max_w: glyph_data.max_w,
      max_h: glyph_data.max_h,
      line_height,
      baseline,
    },
    preview: Some(GeneratedPreview { glyphs }),
    c: Some(GeneratedC {
      header: String::new(),
      source: cpp_module,
    }),
  })
}

#[tauri::command]
fn export_font(
  app: tauri::AppHandle,
  job: FontJob,
  out_path: Option<String>,
  out_dir: Option<String>,
  filename: String,
) -> Result<ExportResult, String> {
  println!(
    "export_font: out_path={:?}, out_dir={:?}, filename={:?}",
    out_path, out_dir, filename
  );
  let resolved_path = out_path
    .as_deref()
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(|s| s.to_string())
    .or_else(|| out_dir.clone());

  let file_path = if let Some(p) = resolved_path.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
    let candidate = PathBuf::from(p);
    if candidate.exists() && candidate.is_dir() {
      let filename = sanitize_filename(&filename)?;
      candidate.join(filename)
    } else {
      candidate
    }
  } else {
    let filename = sanitize_filename(&filename)?;
    resolve_save_path(&app, None, filename)?
  };
  if let Some(parent) = file_path.parent() {
    fs::create_dir_all(parent)
      .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
  }
  println!("export_font: resolved file_path={}", file_path.display());

  let font = load_font_from_source(&job.source)?;
  if job.range.start > job.range.end {
    return Err("Invalid range: start must be <= end".to_string());
  }

  let (codepoint_map, warnings) = collect_codepoints(&job, &font);
  let fallback_cp = job
    .fallback_char
    .as_deref()
    .and_then(|s| s.trim().chars().next())
    .map(|c| c as u32);
  let glyph_data = build_glyph_data(&font, job.size_px, &codepoint_map, fallback_cp);
  let (line_height, baseline) = line_metrics(&font, job.size_px);
  let cpp_module = generate_cpp_module(&job, &glyph_data, line_height, baseline);

  write_atomic(&file_path, cpp_module.as_bytes())?;

  Ok(ExportResult {
    ok: true,
    warnings,
    output_path: Some(file_path.to_string_lossy().to_string()),
  })
}
#[tauri::command]
fn list_system_fonts() -> Result<Vec<SystemFontInfo>, String> {
  let source = SystemSource::new();
  let families = source.all_families()
    .map_err(|e| format!("Failed to list system fonts: {}", e))?;

  let mut out: Vec<SystemFontInfo> = Vec::new();
  let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

  for family in families {
    if !seen.insert(family.clone()) {
      continue;
    }
    if let Ok(handles) = source.select_family_by_name(&family) {
      for handle in handles.fonts().iter() {
        if let Handle::Path { path, .. } = handle {
          out.push(SystemFontInfo {
            family: family.clone(),
            path: path.to_string_lossy().to_string(),
          });
          break;
        }
      }
    }
  }

  out.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
  Ok(out)
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, dir: Option<String>, filename: String, json: String) -> Result<(), String> {
  let filename = sanitize_filename(&filename)?;
  let file_path = resolve_save_path(&app, dir, filename)?;
  if let Some(parent) = file_path.parent() {
    fs::create_dir_all(parent)
      .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
  }
  write_atomic(&file_path, json.as_bytes())?;
  Ok(())
}

fn write_atomic(path: &PathBuf, contents: &[u8]) -> Result<(), String> {
  let file_name = path
    .file_name()
    .and_then(|s| s.to_str())
    .ok_or_else(|| "Invalid file name".to_string())?;
  let tmp_path = path.with_file_name(format!("{}.tmp", file_name));

  let mut file = fs::File::create(&tmp_path)
    .map_err(|e| format!("Failed to create temp file at {}: {}", tmp_path.display(), e))?;
  file
    .write_all(contents)
    .map_err(|e| format!("Failed to write temp file at {}: {}", tmp_path.display(), e))?;
  file
    .sync_all()
    .map_err(|e| format!("Failed to flush temp file at {}: {}", tmp_path.display(), e))?;

  match fs::rename(&tmp_path, path) {
    Ok(()) => Ok(()),
    Err(e) => {
      if path.exists() {
        fs::remove_file(path)
          .map_err(|err| format!("Failed to remove old file {}: {}", path.display(), err))?;
        fs::rename(&tmp_path, path)
          .map_err(|err| format!("Failed to replace settings file {}: {}", path.display(), err))?;
        Ok(())
      } else {
        Err(format!("Failed to rename temp file to {}: {}", path.display(), e))
      }
    }
  }
}

fn resolve_save_path(
  app: &tauri::AppHandle,
  dir: Option<String>,
  filename: String,
) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_config_dir()
    .map_err(|e| format!("Failed to resolve app config dir: {}", e))?;

  let target_dir = match dir {
    Some(d) if !d.trim().is_empty() => PathBuf::from(d),
    _ => base_dir,
  };

  Ok(target_dir.join(filename))
}

fn load_font_from_source(source: &FontSource) -> Result<Font, String> {
  match source {
    FontSource::File { path } => {
      let bytes = fs::read(path)
        .map_err(|e| format!("Failed to read font file {}: {}", path, e))?;
      Font::from_bytes(bytes, FontSettings::default())
        .map_err(|e| format!("Failed to parse font file {}: {}", path, e))
    }
    FontSource::System { family } => {
      let bytes = fs::read(family)
        .map_err(|e| format!("Failed to read font file {}: {}", family, e))?;
      Font::from_bytes(bytes, FontSettings::default())
        .map_err(|e| format!("Failed to parse font file {}: {}", family, e))
    }
  }
}

fn collect_codepoints(job: &FontJob, font: &Font) -> (BTreeMap<u32, u16>, Vec<String>) {
  let mut warnings = Vec::new();
  let mut requested: BTreeSet<u32> = BTreeSet::new();

  for cp in job.range.start..=job.range.end {
    if char::from_u32(cp).is_some() {
      requested.insert(cp);
    }
  }

  if let Some(custom) = &job.custom_chars {
    for ch in custom.chars() {
      requested.insert(ch as u32);
    }
  }

  let fallback = parse_fallback_char(job, &mut warnings);
  let mut final_map: BTreeMap<u32, u16> = BTreeMap::new();

  for cp in requested {
    let ch = match char::from_u32(cp) {
      Some(c) => c,
      None => continue,
    };

    let glyph_index = font.lookup_glyph_index(ch);
    if glyph_index != 0 {
      final_map.insert(cp, glyph_index);
      continue;
    }

    match fallback {
      Some(fb) => {
        let fallback_index = font.lookup_glyph_index(fb);
        if fallback_index != 0 {
          warnings.push(format!("Missing glyph U+{:04X}, using fallback U+{:04X}", cp, fb as u32));
          final_map.insert(cp, fallback_index);
        } else {
          warnings.push(format!(
            "Missing glyph U+{:04X} and fallback U+{:04X} not found",
            cp,
            fb as u32
          ));
        }
      }
      None => {
        warnings.push(format!("Missing glyph U+{:04X}", cp));
      }
    }
  }

  (final_map, warnings)
}

fn parse_fallback_char(job: &FontJob, warnings: &mut Vec<String>) -> Option<char> {
  let fallback = job.fallback_char.as_deref()?.trim();
  if fallback.is_empty() {
    return None;
  }
  let mut chars = fallback.chars();
  let first = chars.next()?;
  if chars.next().is_some() {
    warnings.push("Fallback char has multiple characters, using the first one".to_string());
  }
  Some(first)
}

fn build_preview(
  font: &Font,
  size_px: u32,
  codepoint_map: &BTreeMap<u32, u16>,
) -> (Vec<PreviewGlyph>, Option<(usize, usize)>) {
  let mut glyphs = Vec::new();
  let mut total_bytes: usize = 0;
  let mut truncated: Option<(usize, usize)> = None;

  let mut seen: HashSet<u16> = HashSet::new();
  let mut unique_indices: Vec<u16> = Vec::new();
  let mut representative_cp: BTreeMap<u16, u32> = BTreeMap::new();
  for (cp, glyph_index) in codepoint_map.iter() {
    if seen.insert(*glyph_index) {
      unique_indices.push(*glyph_index);
      representative_cp.insert(*glyph_index, *cp);
    }
  }

  for glyph_index in unique_indices.iter().take(PREVIEW_MAX_GLYPHS) {
    let (metrics, bitmap) = font.rasterize_indexed(*glyph_index, size_px as f32);
    let codepoint = representative_cp.get(glyph_index).copied().unwrap_or(0);
    let w = metrics.width as u32;
    let h = metrics.height as u32;
    let advance = metrics.advance_width as u32;
    let bitmap_b64 = BASE64_STANDARD.encode(&bitmap);

    if total_bytes + bitmap.len() > PREVIEW_MAX_PIXELS_TOTAL {
      truncated = Some((glyphs.len(), total_bytes));
      break;
    }

    total_bytes += bitmap.len();

    glyphs.push(PreviewGlyph {
      codepoint,
      w,
      h,
      advance,
      bitmap_b64,
    });
  }

  if truncated.is_none() && unique_indices.len() > PREVIEW_MAX_GLYPHS {
    truncated = Some((glyphs.len(), total_bytes));
  }

  (glyphs, truncated)
}

fn build_glyph_data(
  font: &Font,
  size_px: u32,
  codepoint_map: &BTreeMap<u32, u16>,
  fallback_cp: Option<u32>,
) -> GlyphData {
  let mut unique_indices: Vec<u16> = Vec::new();
  let mut seen: HashSet<u16> = HashSet::new();
  let mut rep_cp: BTreeMap<u16, u32> = BTreeMap::new();
  for (cp, glyph_index) in codepoint_map.iter() {
    if seen.insert(*glyph_index) {
      unique_indices.push(*glyph_index);
      rep_cp.insert(*glyph_index, *cp);
    }
  }

  let mut bitmaps: Vec<u8> = Vec::new();
  let mut packed_glyphs: Vec<PackedGlyph> = Vec::new();
  let mut glyph_info: HashMap<u16, GlyphEntry> = HashMap::new();
  let mut max_w: u32 = 0;
  let mut max_h: u32 = 0;

  for glyph_index in unique_indices {
    let (metrics, bitmap) = font.rasterize_indexed(glyph_index, size_px as f32);
    let w = metrics.width as u32;
    let h = metrics.height as u32;
    if w > max_w {
      max_w = w;
    }
    if h > max_h {
      max_h = h;
    }
    let (packed, _stride) = pack_bitmap_1b(&bitmap, w, h);
    let offset = bitmaps.len();
    let len = packed.len();
    bitmaps.extend_from_slice(&packed);
    packed_glyphs.push(PackedGlyph {
      codepoint: *rep_cp.get(&glyph_index).unwrap_or(&0),
      offset,
      len,
    });

    let x_advance = metrics.advance_width.round() as i32;
    let x_offset = metrics.xmin;
    let y_offset = metrics.ymin + metrics.height as i32;

    glyph_info.insert(
      glyph_index,
      GlyphEntry {
        offset,
        width: metrics.width as i32,
        height: metrics.height as i32,
        x_advance,
        x_offset,
        y_offset,
      },
    );
  }

  let mut glyphs: Vec<GlyphEntry> = Vec::with_capacity(codepoint_map.len());
  let mut codepoints: Vec<u32> = Vec::with_capacity(codepoint_map.len());
  let mut ranges: Vec<GlyphRangeEntry> = Vec::new();
  let mut last_cp: Option<u32> = None;
  let mut range_start: u32 = 0;
  let mut range_start_index: u16 = 0;
  let mut index: u16 = 0;
  let mut fallback_index: Option<usize> = None;

  for (cp, glyph_index) in codepoint_map.iter() {
    if let Some(prev) = last_cp {
      if *cp != prev + 1 {
        let length = (index - range_start_index) as u16;
        ranges.push(GlyphRangeEntry {
          start: range_start,
          length,
          glyph_id_start: range_start_index,
        });
        range_start = *cp;
        range_start_index = index;
      }
    } else {
      range_start = *cp;
      range_start_index = index;
    }

    if let Some(entry) = glyph_info.get(glyph_index) {
      glyphs.push(GlyphEntry { ..*entry });
    }
    codepoints.push(*cp);

    if let Some(fallback) = fallback_cp {
      if *cp == fallback {
        fallback_index = Some(index as usize);
      }
    }

    last_cp = Some(*cp);
    index = index.saturating_add(1);
  }

  if last_cp.is_some() {
    let length = (index - range_start_index) as u16;
    ranges.push(GlyphRangeEntry {
      start: range_start,
      length,
      glyph_id_start: range_start_index,
    });
  }

  GlyphData {
    bitmaps,
    packed_glyphs,
    glyphs,
    codepoints,
    ranges,
    fallback_index,
    max_w,
    max_h,
  }
}

fn line_metrics(font: &Font, size_px: u32) -> (i32, i32) {
  if let Some(m) = font.horizontal_line_metrics(size_px as f32) {
    let line_height = m.new_line_size.round() as i32;
    let baseline = m.ascent.round() as i32;
    (line_height, baseline)
  } else {
    let line_height = size_px as i32;
    let baseline = (size_px as f32 * 0.8).round() as i32;
    (line_height, baseline)
  }
}

fn format_byte(value: u8, number_format: &str) -> String {
  if number_format == "dec" {
    format!("{}", value)
  } else if number_format == "bin" {
    format!("0b{:08b}", value)
  } else {
    format!("0x{:02X}", value)
  }
}

fn display_char(codepoint: u32) -> char {
  if (32..=126).contains(&codepoint) {
    char::from_u32(codepoint).unwrap_or('?')
  } else {
    '?'
  }
}

fn generate_cpp_module(job: &FontJob, data: &GlyphData, line_height: i32, baseline: i32) -> String {
  let module_name = if !job.module_name.trim().is_empty() {
    job.module_name.trim()
  } else if !job.export_name.trim().is_empty() {
    job.export_name.trim()
  } else {
    "font_module"
  };
  let export_name = if !job.export_name.trim().is_empty() {
    job.export_name.trim()
  } else {
    "font"
  };

  let mut out = String::new();
  out.push_str("module;\n");
  out.push_str("#include <cstdint>\n");
  out.push_str("#include <span>\n");
  out.push_str(&format!("export module {};\n\n", module_name));
  out.push_str("import ui_font;\n\n");
  out.push_str("// Bitmap format: 1-bit packed, row-major, MSB-first.\n");
  out.push_str("// stride = (width + 7) / 8\n");
  out.push_str("// byte_index = y * stride + (x >> 3)\n");
  out.push_str("// bit_mask   = 0x80 >> (x & 7)\n\n");

  out.push_str("static constexpr uint8_t glyph_bitmaps[] = {\n");
  for packed in &data.packed_glyphs {
    let ch = display_char(packed.codepoint);
    out.push_str(&format!("    // code {} ('{}')\n", packed.codepoint, ch));
    let end = packed.offset + packed.len;
    for b in &data.bitmaps[packed.offset..end] {
      out.push_str(&format!("    {},\n", format_byte(*b, &job.number_format)));
    }
  }
  out.push_str("};\n\n");

  out.push_str("static constexpr Glyph glyph_table[] = {\n");
  for (idx, entry) in data.glyphs.iter().enumerate() {
    let cp = data.codepoints.get(idx).copied().unwrap_or(0);
    let ch = display_char(cp);
    out.push_str(&format!("    // {} (code {})\n", ch, cp));
    out.push_str(&format!(
      "    {{ glyph_bitmaps + {}, {}, {}, {}, {}, {} }},\n",
      entry.offset, entry.width, entry.height, entry.x_advance, entry.x_offset, entry.y_offset
    ));
  }
  out.push_str("};\n\n");

  out.push_str("static constexpr GlyphRange glyph_ranges[] = {\n");
  for range in &data.ranges {
    out.push_str(&format!(
      "    {{ {}, {}, {} }},\n",
      range.start, range.length, range.glyph_id_start
    ));
  }
  out.push_str("};\n\n");

  out.push_str(&format!("export constexpr Font {} = {{\n", export_name));
  out.push_str("    .table = glyph_table,\n");
  out.push_str("    .ranges = glyph_ranges,\n");
  if let Some(idx) = data.fallback_index {
    out.push_str(&format!("    .fallback_glyph = &glyph_table[{}],\n", idx));
  } else {
    out.push_str("    .fallback_glyph = nullptr,\n");
  }
  out.push_str(&format!("    .line_height = {},\n", line_height));
  out.push_str(&format!("    .baseline = {}\n", baseline));
  out.push_str("};\n");

  out
}

fn pack_bitmap_1b(gray: &[u8], w: u32, h: u32) -> (Vec<u8>, usize) {
  let stride = ((w + 7) / 8) as usize;
  if w == 0 || h == 0 {
    return (Vec::new(), stride);
  }
  let mut packed = vec![0u8; stride * h as usize];
  for y in 0..h {
    let row_offset = (y as usize) * stride;
    let src_row = (y as usize) * (w as usize);
    for x in 0..w {
      let src_idx = src_row + x as usize;
      if gray[src_idx] >= PACK_THRESHOLD {
        let byte_index = row_offset + (x as usize >> 3);
        let bit_mask = 0x80u8 >> (x as u8 & 7);
        packed[byte_index] |= bit_mask;
      }
    }
  }
  (packed, stride)
}

fn sanitize_filename(filename: &str) -> Result<String, String> {
  let trimmed = filename.trim();
  if trimmed.is_empty() {
    return Ok("settings.json".to_string());
  }
  if trimmed.contains('/') || trimmed.contains('\\') {
    return Err("Invalid filename".to_string());
  }
  Ok(trimmed.to_string())
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle, path: Option<String>) -> Result<String, String> {
  let file_path = resolve_load_path(&app, path)?;
  if !file_path.exists() {
    return Ok(String::new());
  }
  let base_contents = fs::read_to_string(&file_path)
    .map_err(|e| format!("Failed to read settings file {}: {}", file_path.display(), e))?;

  if let Ok(value) = serde_json::from_str::<Value>(&base_contents) {
    if let Some(true) = value.get("meta").and_then(|m| m.get("rememberPath")).and_then(|v| v.as_bool()) {
      if let Some(dir) = value.get("meta").and_then(|m| m.get("lastDir")).and_then(|v| v.as_str()) {
        if !dir.trim().is_empty() {
          let dir_path = PathBuf::from(dir);
          if dir_path.exists() && dir_path.is_dir() {
            let meta = value.get("meta").unwrap_or(&Value::Null);
            let last_file = meta.get("lastFile").and_then(|v| v.as_str()).unwrap_or("");
            if !last_file.trim().is_empty() {
              let candidate = dir_path.join(last_file);
              if candidate.exists() {
                let override_contents = fs::read_to_string(&candidate)
                  .map_err(|e| format!("Failed to read settings file {}: {}", candidate.display(), e))?;
                return Ok(override_contents);
              }
            }
            let fallback = dir_path.join("settings.json");
            if fallback.exists() {
              let override_contents = fs::read_to_string(&fallback)
                .map_err(|e| format!("Failed to read settings file {}: {}", fallback.display(), e))?;
              return Ok(override_contents);
            }
          }
        }
      }
    }
  }

  Ok(base_contents)
}

fn resolve_load_path(app: &tauri::AppHandle, path: Option<String>) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_config_dir()
    .map_err(|e| format!("Failed to resolve app config dir: {}", e))?;

  match path {
    Some(p) => {
      let p = PathBuf::from(p);
      if p.is_absolute() {
        if p.is_dir() {
          Ok(p.join("settings.json"))
        } else {
          Ok(p)
        }
      } else {
        Ok(base_dir.join(p))
      }
    }
    None => {
      let primary = base_dir.join("settings.json");
      if primary.exists() {
        Ok(primary)
      } else {
        Ok(base_dir.join("charm-bake.json"))
      }
    }
  }
}

fn main() {
  tauri::Builder::default()
      .plugin(tauri_plugin_dialog::init())
      .invoke_handler(tauri::generate_handler![save_settings, load_settings, generate_font, export_font, list_system_fonts])
      .run(tauri::generate_context!())
      .expect("Failed to run Tauri application");
}
