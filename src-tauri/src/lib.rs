use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

const OPENCODE_PORT: u16 = 4096;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionMeta {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub cwd: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SessionsStore {
    pub sessions: Vec<SessionMeta>,
}

pub struct AppState {
    opencode_pid: Mutex<Option<u32>>,
}

fn get_dilag_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".dilag")
}

fn get_sessions_dir() -> PathBuf {
    get_dilag_dir().join("sessions")
}

fn get_sessions_file() -> PathBuf {
    get_dilag_dir().join("sessions.json")
}

#[tauri::command]
fn get_opencode_port() -> u16 {
    OPENCODE_PORT
}

#[tauri::command]
fn create_session_dir(session_id: String) -> Result<String, String> {
    let session_dir = get_sessions_dir().join(&session_id);
    fs::create_dir_all(&session_dir).map_err(|e| e.to_string())?;
    Ok(session_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn get_session_cwd(session_id: String) -> String {
    get_sessions_dir()
        .join(&session_id)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn save_session_metadata(session: SessionMeta) -> Result<(), String> {
    let file_path = get_sessions_file();

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Load existing sessions
    let mut store = load_sessions_store();

    // Update or add session
    if let Some(existing) = store.sessions.iter_mut().find(|s| s.id == session.id) {
        *existing = session;
    } else {
        store.sessions.push(session);
    }

    // Save back
    let json = serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?;
    fs::write(&file_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn load_sessions_metadata() -> Vec<SessionMeta> {
    load_sessions_store().sessions
}

#[tauri::command]
fn delete_session_metadata(session_id: String) -> Result<(), String> {
    let file_path = get_sessions_file();
    let mut store = load_sessions_store();

    store.sessions.retain(|s| s.id != session_id);

    let json = serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?;
    fs::write(&file_path, json).map_err(|e| e.to_string())?;

    // Also remove the session directory
    let session_dir = get_sessions_dir().join(&session_id);
    if session_dir.exists() {
        fs::remove_dir_all(&session_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn load_sessions_store() -> SessionsStore {
    let file_path = get_sessions_file();
    if file_path.exists() {
        let content = fs::read_to_string(&file_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        SessionsStore::default()
    }
}

#[tauri::command]
async fn start_opencode_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<u16, String> {
    use tauri_plugin_shell::ShellExt;

    // Check if already running
    if state.opencode_pid.lock().unwrap().is_some() {
        return Ok(OPENCODE_PORT);
    }

    // Ensure dilag directories exist
    fs::create_dir_all(get_sessions_dir()).map_err(|e| e.to_string())?;

    // Spawn opencode server
    let shell = app.shell();
    let (_rx, child) = shell
        .command("opencode")
        .args(["serve", "--port", &OPENCODE_PORT.to_string(), "--hostname", "127.0.0.1"])
        .spawn()
        .map_err(|e| format!("Failed to start opencode server: {}", e))?;

    // Store the PID
    *state.opencode_pid.lock().unwrap() = Some(child.pid());

    // Give server time to start
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(OPENCODE_PORT)
}

#[tauri::command]
async fn stop_opencode_server(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut pid_guard = state.opencode_pid.lock().unwrap();
    if let Some(_pid) = pid_guard.take() {
        // The process will be killed when dropped, or we can explicitly kill it
        // For now, just clear the state - the OS will clean up on app exit
    }
    Ok(())
}

#[tauri::command]
fn is_opencode_running(state: tauri::State<'_, AppState>) -> bool {
    state.opencode_pid.lock().unwrap().is_some()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            opencode_pid: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_opencode_port,
            create_session_dir,
            get_session_cwd,
            save_session_metadata,
            load_sessions_metadata,
            delete_session_metadata,
            start_opencode_server,
            stop_opencode_server,
            is_opencode_running,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
