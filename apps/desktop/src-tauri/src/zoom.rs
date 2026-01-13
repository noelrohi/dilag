use std::sync::Mutex;
use tauri::{AppHandle, Manager};

const ZOOM_STEP: f64 = 0.1;
const MIN_ZOOM: f64 = 0.5;
const MAX_ZOOM: f64 = 2.0;
const DEFAULT_ZOOM: f64 = 1.0;

// Track zoom level since Tauri doesn't have a getter
static CURRENT_ZOOM: Mutex<f64> = Mutex::new(DEFAULT_ZOOM);

#[tauri::command]
pub fn set_zoom_level(app: AppHandle, level: f64) -> Result<f64, String> {
    let clamped = level.clamp(MIN_ZOOM, MAX_ZOOM);
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_zoom(clamped)
            .map_err(|e| format!("Failed to set zoom: {}", e))?;
        *CURRENT_ZOOM.lock().unwrap() = clamped;
        Ok(clamped)
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
pub fn get_zoom_level() -> f64 {
    *CURRENT_ZOOM.lock().unwrap()
}

#[tauri::command]
pub fn zoom_in(app: AppHandle) -> Result<f64, String> {
    let current = get_zoom_level();
    let new_level = (current + ZOOM_STEP).min(MAX_ZOOM);
    set_zoom_level(app, new_level)
}

#[tauri::command]
pub fn zoom_out(app: AppHandle) -> Result<f64, String> {
    let current = get_zoom_level();
    let new_level = (current - ZOOM_STEP).max(MIN_ZOOM);
    set_zoom_level(app, new_level)
}

#[tauri::command]
pub fn zoom_reset(app: AppHandle) -> Result<f64, String> {
    set_zoom_level(app, DEFAULT_ZOOM)
}
