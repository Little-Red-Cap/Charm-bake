// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod font_builder;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

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
fn save_settings(app: tauri::AppHandle, dir: Option<String>, filename: String, json: String) -> Result<(), String> {
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
          let candidate = PathBuf::from(dir).join("settings.json");
          if candidate.exists() {
            if let Ok(override_contents) = fs::read_to_string(&candidate) {
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

#[tauri::command]
fn greet(name: &str) -> String {
  format!("你好, {}! 欢迎使用 Charm Font Tool!", name)
}

fn main() {
  tauri::Builder::default()
      .plugin(tauri_plugin_dialog::init())
      .invoke_handler(tauri::generate_handler![greet, generate_font, save_settings, load_settings])
      .run(tauri::generate_context!())
      .expect("运行 Tauri 应用时出错");
}
