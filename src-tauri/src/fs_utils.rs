use std::fs;
use std::io::Write;
use std::path::PathBuf;

pub fn write_atomic(path: &PathBuf, contents: &[u8]) -> Result<(), String> {
    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?;
    let tmp_path = path.with_file_name(format!("{}.tmp", file_name));

    let mut file = fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temp file at {}: {}", tmp_path.display(), e))?;
    file.write_all(contents)
        .map_err(|e| format!("Failed to write temp file at {}: {}", tmp_path.display(), e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to flush temp file at {}: {}", tmp_path.display(), e))?;

    match fs::rename(&tmp_path, path) {
        Ok(()) => Ok(()),
        Err(e) => {
            if path.exists() {
                fs::remove_file(path)
                    .map_err(|err| format!("Failed to remove old file {}: {}", path.display(), err))?;
                fs::rename(&tmp_path, path)
                    .map_err(|err| format!("Failed to replace file {}: {}", path.display(), err))?;
                Ok(())
            } else {
                Err(format!("Failed to rename temp file to {}: {}", path.display(), e))
            }
        }
    }
}

pub fn sanitize_filename(filename: &str) -> Result<String, String> {
    let trimmed = filename.trim();
    if trimmed.is_empty() {
        // TODO: allow caller to provide context-specific defaults.
        return Ok("settings.json".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Invalid filename".to_string());
    }
    Ok(trimmed.to_string())
}
