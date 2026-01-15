use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use font_kit::handle::Handle;
use font_kit::source::SystemSource;
use fontdue::{Font, FontSettings};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

use crate::fs_utils::{sanitize_filename, write_atomic};
use crate::settings::resolve_save_path;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "mode")]
pub enum FontSource {
    #[serde(rename = "system")]
    System { family: String },
    #[serde(rename = "file")]
    File { path: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Range {
    start: u32,
    end: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FontJob {
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
    #[serde(default = "default_binarize_mode")]
    binarize_mode: String,
    #[serde(default = "default_threshold")]
    threshold: u8,
    #[serde(default = "default_gamma")]
    gamma: f32,
    #[serde(default = "default_oversample")]
    oversample: u32,
}

#[derive(Debug, Serialize)]
pub struct GeneratedResult {
    ok: bool,
    warnings: Vec<String>,
    stats: GeneratedStats,
    preview: Option<GeneratedPreview>,
    c: Option<GeneratedC>,
}

#[derive(Debug, Serialize)]
pub struct GeneratedStats {
    glyph_count: u32,
    bytes: u32,
    max_w: u32,
    max_h: u32,
    line_height: i32,
    baseline: i32,
}

#[derive(Debug, Serialize)]
pub struct GeneratedPreview {
    glyphs: Vec<PreviewGlyph>,
}

#[derive(Debug, Serialize)]
pub struct PreviewGlyph {
    codepoint: u32,
    w: u32,
    h: u32,
    advance: u32,
    bitmap_b64: String,
    mono_b64: String,
}

#[derive(Debug, Serialize)]
pub struct GeneratedC {
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
pub struct ExportResult {
    ok: bool,
    warnings: Vec<String>,
    output_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExportFontArgs {
    job: FontJob,
    out_path: Option<String>,
    filename: String,
}

const PREVIEW_MAX_GLYPHS: usize = 256;
const PREVIEW_MAX_PIXELS_TOTAL: usize = 4 * 1024 * 1024; // 4MB raw grayscale
fn default_binarize_mode() -> String {
    "mask".to_string()
}

fn default_threshold() -> u8 {
    128
}

fn default_gamma() -> f32 {
    1.4
}

fn default_oversample() -> u32 {
    2
}

#[tauri::command]
pub fn generate_font(job: FontJob) -> Result<GeneratedResult, String> {
    let font = load_font_from_source(&job.source)?;

    if job.range.start > job.range.end {
        return Err("Invalid range: start must be <= end".to_string());
    }

    let (codepoint_map, mut warnings) = collect_codepoints(&job, &font);
    let fallback_cp = job
        .fallback_char
        .as_deref()
        .and_then(|s| s.trim().chars().next())
        .map(|c| c as u32);
    let glyph_data = build_glyph_data(&font, job.size_px, &codepoint_map, fallback_cp, &job.binarize_mode, job.threshold, job.gamma, job.oversample);
    let (glyphs, preview_truncated) = build_preview(&font, job.size_px, &codepoint_map, &job.binarize_mode, job.threshold, job.gamma, job.oversample);
    if let Some((count, bytes)) = preview_truncated {
        warnings.push(format!("Preview truncated (glyphs={}, bytes={})", count, bytes));
    }

    let (line_height, baseline) = line_metrics(&font, job.size_px);
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
pub fn export_font(
    app: tauri::AppHandle,
    args: ExportFontArgs,
) -> Result<ExportResult, String> {
    let file_path = if let Some(p) = args.out_path.as_deref().map(str::trim).filter(|s| !s.is_empty())
    {
        let candidate = PathBuf::from(p);
        if candidate.exists() && candidate.is_dir() {
            let filename = sanitize_filename(&args.filename)?;
            candidate.join(filename)
        } else {
            candidate
        }
    } else {
        let filename = sanitize_filename(&args.filename)?;
        resolve_save_path(&app, None, filename)?
    };
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }
    let font = load_font_from_source(&args.job.source)?;
    if args.job.range.start > args.job.range.end {
        return Err("Invalid range: start must be <= end".to_string());
    }

    let (codepoint_map, warnings) = collect_codepoints(&args.job, &font);
    let fallback_cp = args
        .job
        .fallback_char
        .as_deref()
        .and_then(|s| s.trim().chars().next())
        .map(|c| c as u32);
    let glyph_data = build_glyph_data(
        &font,
        args.job.size_px,
        &codepoint_map,
        fallback_cp,
        &args.job.binarize_mode,
        args.job.threshold,
        args.job.gamma,
        args.job.oversample,
    );
    let (line_height, baseline) = line_metrics(&font, args.job.size_px);
    let cpp_module = generate_cpp_module(&args.job, &glyph_data, line_height, baseline);

    write_atomic(&file_path, cpp_module.as_bytes())?;

    Ok(ExportResult {
        ok: true,
        warnings,
        output_path: Some(file_path.to_string_lossy().to_string()),
    })
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
            let source = SystemSource::new();
            let family_handle = source
                .select_family_by_name(family)
                .map_err(|e| format!("Failed to find system font {}: {}", family, e))?;
            let handle = family_handle
                .fonts()
                .first()
                .ok_or_else(|| format!("No fonts found for family {}", family))?;
            match handle {
                Handle::Path { path, .. } => {
                    let bytes = fs::read(path)
                        .map_err(|e| format!("Failed to read font file {}: {}", path.display(), e))?;
                    Font::from_bytes(bytes, FontSettings::default())
                        .map_err(|e| format!("Failed to parse font file {}: {}", path.display(), e))
                }
                Handle::Memory { bytes, .. } => {
                    Font::from_bytes((**bytes).clone(), FontSettings::default())
                        .map_err(|e| format!("Failed to parse in-memory font {}: {}", family, e))
                }
            }
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
                    warnings.push(format!(
                        "Missing glyph U+{:04X}, using fallback U+{:04X}",
                        cp,
                        fb as u32
                    ));
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
enum BinarizeMode {
    Mask,
    GammaOversample,
}

fn parse_binarize_mode(mode: &str) -> BinarizeMode {
    if mode == "gamma_oversample" {
        BinarizeMode::GammaOversample
    } else {
        BinarizeMode::Mask
    }
}

fn clamp_oversample(value: u32) -> u32 {
    if value < 1 {
        1
    } else if value > 4 {
        4
    } else {
        value
    }
}

fn apply_gamma(gray: &[u8], gamma: f32) -> Vec<u8> {
    if gamma <= 0.0 || (gamma - 1.0).abs() < f32::EPSILON {
        return gray.to_vec();
    }
    gray.iter()
        .map(|v| {
            let n = (*v as f32) / 255.0;
            let g = n.powf(gamma).clamp(0.0, 1.0);
            (g * 255.0).round() as u8
        })
        .collect()
}

fn downsample_gray(
    src: &[u8],
    src_w: usize,
    src_h: usize,
    dst_w: usize,
    dst_h: usize,
    gamma: f32,
) -> Vec<u8> {
    if src_w == 0 || src_h == 0 || dst_w == 0 || dst_h == 0 {
        return Vec::new();
    }
    let scale_x = src_w as f32 / dst_w as f32;
    let scale_y = src_h as f32 / dst_h as f32;
    let mut out = vec![0u8; dst_w * dst_h];

    for y in 0..dst_h {
        let mut y0 = (y as f32 * scale_y).floor() as usize;
        let mut y1 = ((y + 1) as f32 * scale_y).ceil() as usize;
        if y0 >= src_h {
            y0 = src_h - 1;
        }
        if y1 > src_h {
            y1 = src_h;
        }
        if y1 <= y0 {
            y1 = (y0 + 1).min(src_h);
        }

        for x in 0..dst_w {
            let mut x0 = (x as f32 * scale_x).floor() as usize;
            let mut x1 = ((x + 1) as f32 * scale_x).ceil() as usize;
            if x0 >= src_w {
                x0 = src_w - 1;
            }
            if x1 > src_w {
                x1 = src_w;
            }
            if x1 <= x0 {
                x1 = (x0 + 1).min(src_w);
            }

            let mut sum: u32 = 0;
            let mut count: u32 = 0;
            for yy in y0..y1 {
                let row = yy * src_w;
                for xx in x0..x1 {
                    sum += src[row + xx] as u32;
                    count += 1;
                }
            }
            let mut v = if count > 0 { sum as f32 / count as f32 } else { 0.0 };
            if gamma > 0.0 && (gamma - 1.0).abs() > f32::EPSILON {
                let n = (v / 255.0).clamp(0.0, 1.0);
                v = n.powf(gamma) * 255.0;
            }
            out[y * dst_w + x] = v.round() as u8;
        }
    }

    out
}

fn rasterize_gray(
    font: &Font,
    glyph_index: u16,
    size_px: u32,
    mode: &str,
    gamma: f32,
    oversample: u32,
) -> (fontdue::Metrics, Vec<u8>) {
    let (metrics, bitmap) = font.rasterize_indexed(glyph_index, size_px as f32);
    match parse_binarize_mode(mode) {
        BinarizeMode::Mask => (metrics, bitmap),
        BinarizeMode::GammaOversample => {
            let os = clamp_oversample(oversample);
            if os <= 1 {
                return (metrics, apply_gamma(&bitmap, gamma));
            }
            let (os_metrics, os_bitmap) =
                font.rasterize_indexed(glyph_index, size_px as f32 * os as f32);
            let dst_w = metrics.width as usize;
            let dst_h = metrics.height as usize;
            let src_w = os_metrics.width as usize;
            let src_h = os_metrics.height as usize;
            let downs = downsample_gray(&os_bitmap, src_w, src_h, dst_w, dst_h, gamma);
            (metrics, downs)
        }
    }
}

fn build_preview(
    font: &Font,
    size_px: u32,
    codepoint_map: &BTreeMap<u32, u16>,
    binarize_mode: &str,
    threshold: u8,
    gamma: f32,
    oversample: u32,
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
        let (metrics, bitmap) = rasterize_gray(font, *glyph_index, size_px, binarize_mode, gamma, oversample);
        let codepoint = representative_cp.get(glyph_index).copied().unwrap_or(0);
        let w = metrics.width as u32;
        let h = metrics.height as u32;
        let advance = metrics.advance_width as u32;
        let bitmap_b64 = BASE64_STANDARD.encode(&bitmap);
        let (mono, _stride) = pack_bitmap_1b(&bitmap, w, h, threshold);
        let mono_b64 = BASE64_STANDARD.encode(&mono);

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
            mono_b64,
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
    binarize_mode: &str,
    threshold: u8,
    gamma: f32,
    oversample: u32,
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
        let (metrics, bitmap) = rasterize_gray(font, glyph_index, size_px, binarize_mode, gamma, oversample);
        let w = metrics.width as u32;
        let h = metrics.height as u32;
        if w > max_w {
            max_w = w;
        }
        if h > max_h {
            max_h = h;
        }
        let (packed, _stride) = pack_bitmap_1b(&bitmap, w, h, threshold);
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
        if job.with_comments {
            let ch = display_char(packed.codepoint);
            out.push_str(&format!("    // code {} ('{}')\n", packed.codepoint, ch));
        }
        let end = packed.offset + packed.len;
        for b in &data.bitmaps[packed.offset..end] {
            out.push_str(&format!("    {},\n", format_byte(*b, &job.number_format)));
        }
    }
    out.push_str("};\n\n");

    out.push_str("static constexpr Glyph glyph_table[] = {\n");
    for (idx, entry) in data.glyphs.iter().enumerate() {
        if job.with_comments {
            let cp = data.codepoints.get(idx).copied().unwrap_or(0);
            let ch = display_char(cp);
            out.push_str(&format!("    // {} (code {})\n", ch, cp));
        }
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

fn pack_bitmap_1b(gray: &[u8], w: u32, h: u32, threshold: u8) -> (Vec<u8>, usize) {
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
            if gray[src_idx] >= threshold {
                let byte_index = row_offset + (x as usize >> 3);
                let bit_mask = 0x80u8 >> (x as u8 & 7);
                packed[byte_index] |= bit_mask;
            }
        }
    }
    (packed, stride)
}










