// src-tauri/src/font_builder.rs
use ab_glyph::{Font, FontRef, ScaleFont};
use image::{GrayImage, Luma};
use std::fs::File;
use std::io::Write;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct CharRange {
    pub start: u32,
    pub end: u32,
}

impl CharRange {
    pub fn parse(range_str: &str) -> Result<Vec<u32>, String> {
        let mut chars = Vec::new();
        for part in range_str.split(',') {
            let part = part.trim();
            if part.contains('-') {
                let parts: Vec<&str> = part.split('-').collect();
                if parts.len() != 2 {
                    return Err(format!("Invalid range format: {}", part));
                }
                let start: u32 = parts[0].parse()
                    .map_err(|_| format!("Invalid number: {}", parts[0]))?;
                let end: u32 = parts[1].parse()
                    .map_err(|_| format!("Invalid number: {}", parts[1]))?;
                for code in start..=end {
                    chars.push(code);
                }
            } else {
                let code: u32 = part.parse()
                    .map_err(|_| format!("Invalid number: {}", part))?;
                chars.push(code);
            }
        }
        chars.sort_unstable();
        chars.dedup();
        Ok(chars)
    }
}

#[derive(Debug, Clone)]
pub struct GlyphData {
    pub code: u32,
    pub width: u32,
    pub height: u32,
    pub advance: i32,
    pub offset_x: i32,
    pub offset_y: i32,
    pub bitmap: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct GlyphRange {
    pub range_start: u32,
    pub range_length: u32,
    pub glyph_id_start: usize,
}

pub struct FontBuilder {
    font_data: Vec<u8>,
    font_size: f32,
    chars: Vec<u32>,
    fallback_char: u32,
    output_format: OutputFormat,
}

#[derive(Debug, Clone, Copy)]
pub enum OutputFormat {
    Hex,
    Bin,
}

impl FontBuilder {
    pub fn new(
        font_data: Vec<u8>,
        font_size: u32,
        chars: Vec<u32>,
        fallback_char: u32,
        output_format: OutputFormat,
    ) -> Result<Self, String> {
        Ok(Self {
            font_data,
            font_size: font_size as f32,
            chars,
            fallback_char,
            output_format,
        })
    }

    pub fn generate(&self) -> Result<String, String> {
        let font = FontRef::try_from_slice(&self.font_data)
            .map_err(|e| format!("Failed to load font: {}", e))?;

        // Get font metrics - use the font directly
        let ascent = font.ascent_unscaled();
        let descent = font.descent_unscaled();
        let units_per_em = font.units_per_em().unwrap_or(1000.0);

        // Scale metrics to pixel size
        let scale_factor = self.font_size / units_per_em;
        let ascent_px = (ascent * scale_factor).ceil() as i32;
        let descent_px = (descent.abs() * scale_factor).ceil() as i32;
        let line_height = ascent_px + descent_px;
        let baseline = ascent_px;

        println!("Font metrics: ascent={}, descent={}", ascent_px, descent_px);
        println!("Calculated: line_height={}, baseline={}", line_height, baseline);

        // Generate glyphs
        let mut glyphs = Vec::new();
        let mut fallback_index: Option<usize> = None;

        for (idx, &code) in self.chars.iter().enumerate() {
            let glyph_data = self.render_glyph(&font, code, baseline)?;

            if code == self.fallback_char {
                fallback_index = Some(idx);
            }

            glyphs.push(glyph_data);
        }

        // Build ranges
        let ranges = self.build_ranges(&self.chars);

        // Generate C++ module
        let output = self.generate_cpp_module(&glyphs, &ranges, line_height, baseline, fallback_index)?;

        Ok(output)
    }

    fn render_glyph(&self, font: &FontRef, code: u32, baseline: i32) -> Result<GlyphData, String> {
        let ch = char::from_u32(code).ok_or(format!("Invalid character code: {}", code))?;

        let glyph_id = font.glyph_id(ch);
        let glyph = glyph_id.with_scale(self.font_size);

        // Get advance width - use font directly
        let h_advance = font.h_advance_unscaled(glyph_id);
        let units_per_em = font.units_per_em().unwrap_or(1000.0);
        let scale_factor = self.font_size / units_per_em;
        let advance = (h_advance * scale_factor).round() as i32;

        // Try to outline the glyph
        let scaled_font = font.as_scaled(self.font_size);
        if let Some(outlined) = scaled_font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();

            let width = bounds.width().ceil() as u32;
            let height = bounds.height().ceil() as u32;

            if width == 0 || height == 0 {
                // Empty glyph (like space)
                return Ok(GlyphData {
                    code,
                    width: 0,
                    height: 0,
                    advance,
                    offset_x: 0,
                    offset_y: 0,
                    bitmap: Vec::new(),
                });
            }

            let offset_x = bounds.min.x.floor() as i32;
            let glyph_top = bounds.min.y.floor() as i32;
            let offset_y = baseline - glyph_top;

            // Create image and draw glyph
            let mut img = GrayImage::new(width, height);
            outlined.draw(|x, y, coverage| {
                if x < width && y < height {
                    let pixel_value = (coverage * 255.0) as u8;
                    img.put_pixel(x, y, Luma([pixel_value]));
                }
            });

            // Convert to 1-bit bitmap
            let bitmap = self.pack_bitmap(&img);

            Ok(GlyphData {
                code,
                width,
                height,
                advance,
                offset_x,
                offset_y,
                bitmap,
            })
        } else {
            // Glyph has no outline (e.g., space)
            Ok(GlyphData {
                code,
                width: 0,
                height: 0,
                advance,
                offset_x: 0,
                offset_y: 0,
                bitmap: Vec::new(),
            })
        }
    }

    fn pack_bitmap(&self, img: &GrayImage) -> Vec<u8> {
        let width = img.width();
        let height = img.height();
        let mut packed = Vec::new();

        for y in 0..height {
            let mut row_bits: u8 = 0;
            let mut bits_count = 0;

            for x in 0..width {
                let pixel = img.get_pixel(x, y)[0];
                let bit = if pixel > 127 { 1 } else { 0 };

                row_bits = (row_bits << 1) | bit;
                bits_count += 1;

                if bits_count == 8 {
                    packed.push(row_bits);
                    row_bits = 0;
                    bits_count = 0;
                }
            }

            // Push remaining bits in the row
            if bits_count > 0 {
                row_bits <<= 8 - bits_count;
                packed.push(row_bits);
            }
        }

        packed
    }

    fn build_ranges(&self, codes: &[u32]) -> Vec<GlyphRange> {
        if codes.is_empty() {
            return Vec::new();
        }

        let mut ranges = Vec::new();
        let mut range_start = codes[0];
        let mut range_length = 1;
        let mut glyph_id_start = 0;

        for i in 1..codes.len() {
            if codes[i] == codes[i - 1] + 1 {
                range_length += 1;
            } else {
                ranges.push(GlyphRange {
                    range_start,
                    range_length,
                    glyph_id_start,
                });
                range_start = codes[i];
                glyph_id_start = i;
                range_length = 1;
            }
        }

        // Add the last range
        ranges.push(GlyphRange {
            range_start,
            range_length,
            glyph_id_start,
        });

        ranges
    }

    fn generate_cpp_module(
        &self,
        glyphs: &[GlyphData],
        ranges: &[GlyphRange],
        line_height: i32,
        baseline: i32,
        fallback_index: Option<usize>,
    ) -> Result<String, String> {
        let mut output = String::new();

        // Module header
        output.push_str("module;\n");
        output.push_str("#include <cstdint>\n");
        output.push_str("#include <span>\n");
        output.push_str("export module font_generated;\n\n");
        output.push_str("import ui_font;\n\n");

        // Bitmap data
        output.push_str("static constexpr uint8_t glyph_bitmaps[] = {\n");
        for glyph in glyphs {
            let ch = char::from_u32(glyph.code).unwrap_or('?');
            let ch_display = if (32..127).contains(&glyph.code) {
                ch
            } else {
                '?'
            };
            output.push_str(&format!("    // code {} ('{}')\n", glyph.code, ch_display));

            for byte in &glyph.bitmap {
                match self.output_format {
                    OutputFormat::Hex => {
                        output.push_str(&format!("    0x{:02X},\n", byte));
                    }
                    OutputFormat::Bin => {
                        output.push_str(&format!("    0b{:08b},\n", byte));
                    }
                }
            }
        }
        output.push_str("};\n\n");

        // Glyph table
        output.push_str("static constexpr Glyph glyph_table[] = {\n");
        let mut pos = 0;
        for glyph in glyphs {
            let ch = char::from_u32(glyph.code).unwrap_or('?');
            let ch_display = if (32..127).contains(&glyph.code) {
                ch
            } else {
                '?'
            };
            output.push_str(&format!("    // {} (code {})\n", ch_display, glyph.code));
            output.push_str(&format!(
                "    {{ glyph_bitmaps + {}, {}, {}, {}, {}, {} }},\n",
                pos, glyph.width, glyph.height, glyph.advance, glyph.offset_x, glyph.offset_y
            ));
            pos += glyph.bitmap.len();
        }
        output.push_str("};\n\n");

        // Glyph ranges
        output.push_str("static constexpr GlyphRange glyph_ranges[] = {\n");
        for range in ranges {
            output.push_str(&format!(
                "    {{ {}, {}, {} }},\n",
                range.range_start, range.range_length, range.glyph_id_start
            ));
        }
        output.push_str("};\n\n");

        // Font structure
        output.push_str("export constexpr Font font = {\n");
        output.push_str("    .table = glyph_table,\n");
        output.push_str("    .ranges = glyph_ranges,\n");
        if let Some(idx) = fallback_index {
            output.push_str(&format!("    .fallback_glyph = &glyph_table[{}],\n", idx));
        } else {
            output.push_str("    .fallback_glyph = nullptr,\n");
        }
        output.push_str(&format!("    .line_height = {},\n", line_height));
        output.push_str(&format!("    .baseline = {}\n", baseline));
        output.push_str("};\n");

        Ok(output)
    }
}

pub fn generate_font(
    font_data: Vec<u8>,
    font_size: u32,
    char_ranges: &str,
    fallback_char: u32,
    output_format: &str,
    output_path: &str,
) -> Result<String, String> {
    let (message, _, _) = generate_font_with_stats(
        font_data,
        font_size,
        char_ranges,
        fallback_char,
        output_format,
        output_path
    )?;
    Ok(message)
}

pub fn generate_font_with_stats(
    font_data: Vec<u8>,
    font_size: u32,
    char_ranges: &str,
    fallback_char: u32,
    output_format: &str,
    output_path: &str,
) -> Result<(String, String, (usize, usize, i32, i32)), String> {
    let chars = CharRange::parse(char_ranges)?;

    let format = match output_format.to_lowercase().as_str() {
        "hex" => OutputFormat::Hex,
        "bin" => OutputFormat::Bin,
        _ => return Err(format!("Invalid output format: {}", output_format)),
    };

    let builder = FontBuilder::new(font_data, font_size, chars.clone(), fallback_char, format)?;
    let cpp_code = builder.generate()?;

    // Get stats from builder
    let ranges = builder.build_ranges(&chars);

    // Calculate line_height and baseline (need to recalculate or store)
    let font = FontRef::try_from_slice(&builder.font_data)
        .map_err(|e| format!("Failed to load font: {}", e))?;
    let ascent = font.ascent_unscaled();
    let descent = font.descent_unscaled();
    let units_per_em = font.units_per_em().unwrap_or(1000.0);
    let scale_factor = builder.font_size / units_per_em;
    let ascent_px = (ascent * scale_factor).ceil() as i32;
    let descent_px = (descent.abs() * scale_factor).ceil() as i32;
    let line_height = ascent_px + descent_px;
    let baseline = ascent_px;

    // Write to file
    let mut file = File::create(output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    file.write_all(cpp_code.as_bytes())
        .map_err(|e| format!("Failed to write to file: {}", e))?;

    let stats = (chars.len(), ranges.len(), line_height, baseline);
    Ok((
        format!("Successfully generated font module: {}", output_path),
        cpp_code,
        stats,
    ))
}