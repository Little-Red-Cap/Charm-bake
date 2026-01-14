// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod font_builder;

use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
struct FontConfig {
  font_path: String,
  font_size: u32,
  char_ranges: String,
  fallback_char: u32,
  output_format: String,
  output_path: String,
}

#[derive(Debug, Serialize)]
struct GenerateResult {
  success: bool,
  message: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  error: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  generated_code: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  stats: Option<GenerateStats>,
}

#[derive(Debug, Serialize)]
struct GenerateStats {
  glyph_count: usize,
  range_count: usize,
  line_height: i32,
  baseline: i32,
  file_size: usize,
}

#[tauri::command]
fn generate_font(config: FontConfig) -> Result<GenerateResult, String> {
  println!("Generating font with config: {:?}", config);

  // Read font file
  let font_data = fs::read(&config.font_path)
      .map_err(|e| format!("Failed to read font file: {}", e))?;

  // Generate font and get stats
  match font_builder::generate_font_with_stats(
    font_data,
    config.font_size,
    &config.char_ranges,
    config.fallback_char,
    &config.output_format,
    &config.output_path,
  ) {
    Ok((message, code, stats)) => {
      let file_size = fs::metadata(&config.output_path)
          .map(|m| m.len() as usize)
          .unwrap_or(0);

      Ok(GenerateResult {
        success: true,
        message,
        error: None,
        generated_code: Some(code),
        stats: Some(GenerateStats {
          glyph_count: stats.0,
          range_count: stats.1,
          line_height: stats.2,
          baseline: stats.3,
          file_size,
        }),
      })
    }
    Err(e) => Ok(GenerateResult {
      success: false,
      message: "Failed to generate font".to_string(),
      error: Some(e),
      generated_code: None,
      stats: None,
    }),
  }
}

#[tauri::command]
fn greet(name: &str) -> String {
  format!("你好, {}! 欢迎使用 Charm Font Tool!", name)
}

fn main() {
  tauri::Builder::default()
      .plugin(tauri_plugin_dialog::init())
      .invoke_handler(tauri::generate_handler![greet, generate_font])
      .run(tauri::generate_context!())
      .expect("运行 Tauri 应用时出错");
}