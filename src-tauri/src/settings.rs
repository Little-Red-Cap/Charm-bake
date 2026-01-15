use tauri::Manager;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

use crate::fs_utils::{sanitize_filename, write_atomic};

#[tauri::command]
pub fn save_settings(
    app: tauri::AppHandle,
    dir: Option<String>,
    filename: String,
    json: String,
) -> Result<(), String> {
    let filename = sanitize_filename(&filename)?;
    let file_path = resolve_save_path(&app, dir, filename)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }
    write_atomic(&file_path, json.as_bytes())?;
    Ok(())
}

#[tauri::command]
pub fn save_text_file(path: String, contents: String) -> Result<(), String> {
    let file_path = PathBuf::from(path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }
    write_atomic(&file_path, contents.as_bytes())?;
    Ok(())
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle, path: Option<String>) -> Result<String, String> {
    let file_path = resolve_load_path(&app, path)?;
    if !file_path.exists() {
        return Ok(String::new());
    }
    let base_contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read settings file {}: {}", file_path.display(), e))?;

    if let Ok(value) = serde_json::from_str::<Value>(&base_contents) {
        if let Some(true) = value
            .get("meta")
            .and_then(|m| m.get("rememberPath"))
            .and_then(|v| v.as_bool())
        {
            if let Some(dir) = value
                .get("meta")
                .and_then(|m| m.get("lastDir"))
                .and_then(|v| v.as_str())
            {
                if !dir.trim().is_empty() {
                    let dir_path = PathBuf::from(dir);
                    if dir_path.exists() && dir_path.is_dir() {
                        let meta = value.get("meta").unwrap_or(&Value::Null);
                        let last_file = meta.get("lastFile").and_then(|v| v.as_str()).unwrap_or("");
                        if !last_file.trim().is_empty() {
                            let candidate = dir_path.join(last_file);
                            if candidate.exists() {
                                let override_contents = fs::read_to_string(&candidate)
                                    .map_err(|e| {
                                        format!(
                                            "Failed to read settings file {}: {}",
                                            candidate.display(),
                                            e
                                        )
                                    })?;
                                return Ok(override_contents);
                            }
                        }
                        let fallback = dir_path.join("settings.json");
                        if fallback.exists() {
                            let override_contents = fs::read_to_string(&fallback)
                                .map_err(|e| {
                                    format!(
                                        "Failed to read settings file {}: {}",
                                        fallback.display(),
                                        e
                                    )
                                })?;
                            return Ok(override_contents);
                        }
                    }
                }
            }
        }
    }

    Ok(base_contents)
}

pub fn resolve_save_path(
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
