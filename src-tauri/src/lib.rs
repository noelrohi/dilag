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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DesignFile {
    pub filename: String,
    pub title: String,
    pub screen_type: String,
    pub html: String,
    pub modified_at: u64,
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

fn get_opencode_config_dir() -> PathBuf {
    // OpenCode looks in $XDG_CONFIG_HOME/opencode
    // We set XDG_CONFIG_HOME to ~/.dilag, so config goes in ~/.dilag/opencode/
    get_dilag_dir().join("opencode")
}

fn ensure_config_exists() -> Result<(), String> {
    let config_dir = get_opencode_config_dir();
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    let config_file = config_dir.join("opencode.json");
    if !config_file.exists() {
        let default_config = r#"{
  "$schema": "https://opencode.ai/config.json",
  "autoupdate": false,
  "share": "disabled"
}"#;
        fs::write(&config_file, default_config).map_err(|e| e.to_string())?;
    }
    Ok(())
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

    // Ensure dilag directories and config exist
    fs::create_dir_all(get_sessions_dir()).map_err(|e| e.to_string())?;
    ensure_config_exists()?;

    // Spawn opencode server with isolated config (XDG_CONFIG_HOME)
    // This makes OpenCode look in ~/.dilag/opencode/ for config/plugins
    // Auth still works from ~/.local/share/opencode/ (XDG_DATA_HOME)
    let shell = app.shell();
    let dilag_dir = get_dilag_dir();
    let (_rx, child) = shell
        .command("opencode")
        .args(["serve", "--port", &OPENCODE_PORT.to_string(), "--hostname", "127.0.0.1"])
        .env("XDG_CONFIG_HOME", dilag_dir.to_string_lossy().to_string())
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

#[tauri::command]
fn load_session_designs(session_cwd: String) -> Vec<DesignFile> {
    use std::time::UNIX_EPOCH;

    let session_dir = PathBuf::from(&session_cwd);
    let designs_dir = session_dir.join("designs");
    let mut designs = Vec::new();

    // Helper to process HTML files from a directory
    let mut process_dir = |dir: &PathBuf| {
        if !dir.exists() {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |e| e == "html") {
                    if let Ok(html) = fs::read_to_string(&path) {
                        let filename = path.file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default();

                        // Skip if already added (avoid duplicates)
                        if designs.iter().any(|d: &DesignFile| d.filename == filename) {
                            continue;
                        }

                        // Extract title from data-title attribute or filename
                        let title = extract_html_attr(&html, "data-title")
                            .unwrap_or_else(|| {
                                filename.replace(".html", "")
                                    .split('-')
                                    .map(|w| {
                                        let mut c = w.chars();
                                        match c.next() {
                                            None => String::new(),
                                            Some(f) => f.to_uppercase().chain(c).collect(),
                                        }
                                    })
                                    .collect::<Vec<_>>()
                                    .join(" ")
                            });

                        // Extract screen type from data-screen-type attribute
                        let screen_type = extract_html_attr(&html, "data-screen-type")
                            .unwrap_or_else(|| "web".to_string());

                        // Get modified time
                        let modified_at = entry.metadata()
                            .and_then(|m| m.modified())
                            .map(|t| t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0))
                            .unwrap_or(0);

                        designs.push(DesignFile {
                            filename,
                            title,
                            screen_type,
                            html,
                            modified_at,
                        });
                    }
                }
            }
        }
    };

    // Scan both session root and designs/ subfolder
    process_dir(&session_dir);
    process_dir(&designs_dir);

    // Sort by modified time (newest first)
    designs.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    designs
}

fn extract_html_attr(html: &str, attr: &str) -> Option<String> {
    let pattern = format!(r#"{}=["']([^"']+)["']"#, attr);
    regex::Regex::new(&pattern)
        .ok()?
        .captures(html)?
        .get(1)
        .map(|m| m.as_str().to_string())
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
            load_session_designs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
