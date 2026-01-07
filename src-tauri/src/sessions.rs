use crate::error::{AppError, AppResult};
use crate::paths::{get_sessions_dir, get_sessions_file};
use crate::state::{SessionMeta, SessionsStore};
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use tauri::Manager;

/// Load the sessions store from disk
fn load_sessions_store() -> SessionsStore {
    let file_path = get_sessions_file();
    if file_path.exists() {
        let content = fs::read_to_string(&file_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        SessionsStore::default()
    }
}

// =============================================================================
// Tauri Commands
// =============================================================================

#[tauri::command]
pub fn create_session_dir(session_id: String) -> AppResult<String> {
    let session_dir = get_sessions_dir().join(&session_id);
    fs::create_dir_all(&session_dir)?;
    Ok(session_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_session_cwd(session_id: String) -> String {
    get_sessions_dir()
        .join(&session_id)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub fn save_session_metadata(session: SessionMeta) -> AppResult<()> {
    let file_path = get_sessions_file();

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut store = load_sessions_store();

    if let Some(existing) = store.sessions.iter_mut().find(|s| s.id == session.id) {
        *existing = session;
    } else {
        store.sessions.push(session);
    }

    let json = serde_json::to_string_pretty(&store)?;
    fs::write(&file_path, json)?;

    Ok(())
}

#[tauri::command]
pub fn load_sessions_metadata() -> Vec<SessionMeta> {
    load_sessions_store().sessions
}

#[tauri::command]
pub fn delete_session_metadata(session_id: String) -> AppResult<()> {
    let file_path = get_sessions_file();
    let mut store = load_sessions_store();

    store.sessions.retain(|s| s.id != session_id);

    let json = serde_json::to_string_pretty(&store)?;
    fs::write(&file_path, json)?;

    let session_dir = get_sessions_dir().join(&session_id);
    if session_dir.exists() {
        fs::remove_dir_all(&session_dir)?;
    }

    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> AppResult<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn initialize_web_project(app: AppHandle, session_cwd: String) -> AppResult<()> {
    let resource_template = app
        .path()
        .resource_dir()
        .map_err(|e| AppError::Custom(e.to_string()))?
        .join("templates")
        .join("web-project");

    // In debug builds, prefer the dev template from source tree
    // In release builds, always use bundled resources
    #[cfg(debug_assertions)]
    let dev_template = Some(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("templates")
            .join("web-project"),
    );
    #[cfg(not(debug_assertions))]
    let dev_template: Option<std::path::PathBuf> = None;

    println!("[initialize_web_project] Resource template: {:?} (exists: {})", resource_template, resource_template.exists());
    if let Some(ref dev) = dev_template {
        println!("[initialize_web_project] Dev template: {:?} (exists: {})", dev, dev.exists());
    }

    let template_dir = if let Some(ref dev) = dev_template {
        if dev.exists() {
            println!("[initialize_web_project] Using dev template");
            dev.clone()
        } else if resource_template.exists() {
            println!("[initialize_web_project] Using resource template");
            resource_template
        } else {
            return Err(AppError::Custom(format!(
                "Web project template not found at {:?} or {:?}",
                resource_template, dev
            )));
        }
    } else if resource_template.exists() {
        println!("[initialize_web_project] Using resource template");
        resource_template
    } else {
        return Err(AppError::Custom(format!(
            "Web project template not found at {:?}",
            resource_template
        )));
    };

    println!("[initialize_web_project] Copying from {:?} to {:?}", template_dir, session_cwd);
    
    let dest_dir = Path::new(&session_cwd);
    copy_dir_recursive(&template_dir, dest_dir)?;

    println!("[initialize_web_project] Copy complete");
    Ok(())
}
