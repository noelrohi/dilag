use crate::error::AppResult;
use crate::paths::get_dilag_dir;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub data_dir: String,
    pub data_size_bytes: u64,
}

fn calculate_dir_size(path: &PathBuf) -> u64 {
    if !path.exists() {
        return 0;
    }

    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|entry| {
                    let path = entry.path();
                    if path.is_dir() {
                        calculate_dir_size(&path)
                    } else {
                        entry.metadata().map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    let dilag_dir = get_dilag_dir();
    let data_size = calculate_dir_size(&dilag_dir);

    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_dir: dilag_dir.to_string_lossy().to_string(),
        data_size_bytes: data_size,
    }
}

#[tauri::command]
pub async fn reset_all_data(
    app: AppHandle,
    state: tauri::State<'_, crate::state::AppState>,
) -> AppResult<()> {
    // Stop the opencode server first
    {
        let mut pid_guard = state.opencode_pid.lock().unwrap();
        pid_guard.take();
    }

    // Delete the entire .dilag directory contents
    let dilag_dir = get_dilag_dir();
    if dilag_dir.exists() {
        if let Ok(entries) = fs::read_dir(&dilag_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let _ = fs::remove_dir_all(&path);
                } else {
                    let _ = fs::remove_file(&path);
                }
            }
        }
    }

    // Restart the app
    app.restart();

    #[allow(unreachable_code)]
    Ok(())
}
