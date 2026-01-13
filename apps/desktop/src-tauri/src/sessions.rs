use crate::error::AppResult;
use crate::paths::{get_sessions_dir, get_sessions_file};
use crate::state::{SessionMeta, SessionsStore};
use std::fs;

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

    // Create screens directory by default so agent doesn't need to mkdir
    fs::create_dir_all(session_dir.join("screens"))?;

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

#[tauri::command]
pub fn toggle_session_favorite(session_id: String) -> AppResult<bool> {
    let file_path = get_sessions_file();
    let mut store = load_sessions_store();

    let session = store
        .sessions
        .iter_mut()
        .find(|s| s.id == session_id)
        .ok_or_else(|| crate::error::AppError::Custom(format!("Session {} not found", session_id)))?;

    session.favorite = !session.favorite;
    let new_favorite = session.favorite;

    let json = serde_json::to_string_pretty(&store)?;
    fs::write(&file_path, json)?;

    Ok(new_favorite)
}
