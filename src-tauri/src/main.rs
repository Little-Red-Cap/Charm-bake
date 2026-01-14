// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::Value;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::collections::BTreeSet;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use fontdue::{Font, FontSettings};

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

#[derive(Debug, Serialize)]
struct ExportResult {
  ok: bool,
  warnings: Vec<String>,
  output_path: Option<String>,
}

#[tauri::command]
fn generate_font(_job: FontJob) -> Result<GeneratedResult, String> {
  let _font = load_font_from_source(&_job.source)?;

  if _job.range.start > _job.range.end {
    return Err("Invalid range: start must be <= end".to_string());
  }

  let (codepoints, warnings) = collect_codepoints(&_job, &_font);
  let (glyphs, stats) = build_preview(&_font, _job.size_px, &codepoints);

  Ok(GeneratedResult {
    ok: true,
    warnings,
    stats,
    preview: Some(GeneratedPreview { glyphs }),
    c: None,
  })
}

#[tauri::command]
fn export_font(_job: FontJob, out_dir: Option<String>, filename: String) -> Result<ExportResult, String> {
  let output_path = if let Some(dir) = out_dir {
    if dir.trim().is_empty() {
      None
    } else {
      Some(PathBuf::from(dir).join(filename).to_string_lossy().to_string())
    }
  } else {
    None
  };

  Ok(ExportResult {
    ok: true,
    warnings: vec![],
    output_path,
  })
}
use tauri::Manager;

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

fn collect_codepoints(job: &FontJob, font: &Font) -> (Vec<u32>, Vec<String>) {
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
  let mut final_set: BTreeSet<u32> = BTreeSet::new();

  for cp in requested {
    let ch = match char::from_u32(cp) {
      Some(c) => c,
      None => continue,
    };

    if has_glyph(font, ch) {
      final_set.insert(cp);
      continue;
    }

    match fallback {
      Some(fb) if has_glyph(font, fb) => {
        warnings.push(format!("Missing glyph U+{:04X}, using fallback U+{:04X}", cp, fb as u32));
        final_set.insert(fb as u32);
      }
      Some(fb) => {
        warnings.push(format!(
          "Missing glyph U+{:04X} and fallback U+{:04X} not found",
          cp,
          fb as u32
        ));
        final_set.insert(cp);
      }
      None => {
        warnings.push(format!("Missing glyph U+{:04X}", cp));
        final_set.insert(cp);
      }
    }
  }

  (final_set.into_iter().collect(), warnings)
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

fn has_glyph(font: &Font, ch: char) -> bool {
  font.lookup_glyph_index(ch) != 0
}

fn build_preview(font: &Font, size_px: u32, codepoints: &[u32]) -> (Vec<PreviewGlyph>, GeneratedStats) {
  let mut glyphs = Vec::with_capacity(codepoints.len());
  let mut total_bytes: u32 = 0;
  let mut max_w: u32 = 0;
  let mut max_h: u32 = 0;

  for cp in codepoints {
    let ch = match char::from_u32(*cp) {
      Some(c) => c,
      None => continue,
    };
    let (metrics, bitmap) = font.rasterize(ch, size_px as f32);
    let w = metrics.width as u32;
    let h = metrics.height as u32;
    let advance = metrics.advance_width as u32;
    let bitmap_b64 = BASE64_STANDARD.encode(&bitmap);

    total_bytes = total_bytes.saturating_add(bitmap.len() as u32);
    if w > max_w {
      max_w = w;
    }
    if h > max_h {
      max_h = h;
    }

    glyphs.push(PreviewGlyph {
      codepoint: *cp,
      w,
      h,
      advance,
      bitmap_b64,
    });
  }

  let stats = GeneratedStats {
    glyph_count: glyphs.len() as u32,
    bytes: total_bytes,
    max_w,
    max_h,
  };

  (glyphs, stats)
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
      .invoke_handler(tauri::generate_handler![save_settings, load_settings, generate_font, export_font])
      .run(tauri::generate_context!())
      .expect("Failed to run Tauri application");
}
