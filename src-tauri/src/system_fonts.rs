use font_kit::source::SystemSource;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SystemFontInfo {
    family: String,
}

#[tauri::command]
pub fn list_system_fonts() -> Result<Vec<SystemFontInfo>, String> {
    let source = SystemSource::new();
    let mut families = source
        .all_families()
        .map_err(|e| format!("Failed to list system fonts: {}", e))?;
    families.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(families
        .into_iter()
        .map(|family| SystemFontInfo { family })
        .collect())
}
