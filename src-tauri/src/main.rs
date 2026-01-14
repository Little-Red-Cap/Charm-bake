// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod font_pipeline;
mod fs_utils;
mod settings;
mod system_fonts;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            settings::save_settings,
            settings::load_settings,
            font_pipeline::generate_font,
            font_pipeline::export_font,
            system_fonts::list_system_fonts
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Tauri application");
}
