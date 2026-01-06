use crate::error::{AppError, AppResult};
use crate::paths::{get_dilag_dir, get_opencode_config_dir, get_sessions_dir};
use crate::state::AppState;
use serde::Serialize;
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

pub const VITE_PORT: u16 = 5173;

/// Find a free port by binding to port 0
pub fn get_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("Failed to bind to find free port")
        .local_addr()
        .expect("Failed to get local address")
        .port()
}

pub const DESIGNER_AGENT_PROMPT: &str = include_str!("../assets/web-designer-prompt.md");

#[derive(Debug, Serialize)]
pub struct OpenCodeCheckResult {
    pub installed: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BunCheckResult {
    pub installed: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

/// Find the OpenCode binary in common installation locations
pub fn get_opencode_binary_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;

    let candidates = vec![
        // OpenCode's default install location
        home.join(".opencode/bin/opencode"),
        // npm/bun global installs
        home.join(".npm-global/bin/opencode"),
        home.join(".bun/bin/opencode"),
        // Homebrew paths
        PathBuf::from("/opt/homebrew/bin/opencode"),
        PathBuf::from("/usr/local/bin/opencode"),
        // System paths
        PathBuf::from("/usr/bin/opencode"),
    ];

    candidates.into_iter().find(|path| path.exists() && path.is_file())
}

fn ensure_config_exists() -> AppResult<()> {
    let config_dir = get_opencode_config_dir();
    fs::create_dir_all(&config_dir)?;

    let config_file = config_dir.join("opencode.json");

    let config = serde_json::json!({
        "$schema": "https://opencode.ai/config.json",
        "autoupdate": false,
        "share": "disabled",
        "agent": {
            "designer": {
                "mode": "primary",
                "prompt": DESIGNER_AGENT_PROMPT,
                "description": "Web UI design agent for creating React/TanStack Router pages",
                "permission": {
                    "bash": "deny"
                }
            }
        }
    });

    let config_str = serde_json::to_string_pretty(&config)?;
    fs::write(&config_file, config_str)?;

    Ok(())
}

fn kill_process(pid: u32) {
    #[cfg(unix)]
    {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output();
    }
}

// =============================================================================
// Tauri Commands
// =============================================================================

#[tauri::command]
pub async fn check_opencode_installation(app: AppHandle) -> OpenCodeCheckResult {
    let shell = app.shell();
    let opencode_path = get_opencode_binary_path();

    let command = if let Some(ref path) = opencode_path {
        shell.command(path)
    } else {
        shell.command("opencode")
    };

    match command.args(["--version"]).output().await {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                OpenCodeCheckResult {
                    installed: true,
                    version: if version.is_empty() {
                        None
                    } else {
                        Some(version)
                    },
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                OpenCodeCheckResult {
                    installed: false,
                    version: None,
                    error: if stderr.is_empty() { None } else { Some(stderr) },
                }
            }
        }
        Err(e) => OpenCodeCheckResult {
            installed: false,
            version: None,
            error: Some(format!("OpenCode CLI not found: {}", e)),
        },
    }
}

#[tauri::command]
pub fn get_opencode_port(state: tauri::State<'_, AppState>) -> Option<u16> {
    *state.opencode_port.lock().unwrap()
}

#[tauri::command]
pub async fn start_opencode_server(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<u16> {
    if state.opencode_pid.lock().unwrap().is_some() {
        if let Some(port) = *state.opencode_port.lock().unwrap() {
            return Ok(port);
        }
    }

    let port = state
        .opencode_port
        .lock()
        .unwrap()
        .ok_or_else(|| AppError::Custom("OpenCode port not initialized".to_string()))?;

    fs::create_dir_all(get_sessions_dir())?;
    ensure_config_exists()?;

    let opencode_path = get_opencode_binary_path().ok_or(AppError::OpenCodeNotFound)?;

    let shell = app.shell();
    let dilag_dir = get_dilag_dir();
    println!(
        "[start_opencode_server] Starting on port {} with XDG_CONFIG_HOME={:?}",
        port, dilag_dir
    );

    let (_rx, child) = shell
        .command(&opencode_path)
        .args([
            "serve",
            "--port",
            &port.to_string(),
            "--hostname",
            "127.0.0.1",
        ])
        .env("XDG_CONFIG_HOME", dilag_dir.to_string_lossy().to_string())
        .spawn()
        .map_err(|e| AppError::ServerStart(e.to_string()))?;

    *state.opencode_pid.lock().unwrap() = Some(child.pid());

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(port)
}

#[tauri::command]
pub async fn stop_opencode_server(state: tauri::State<'_, AppState>) -> AppResult<()> {
    let mut pid_guard = state.opencode_pid.lock().unwrap();
    if let Some(pid) = pid_guard.take() {
        kill_process(pid);
    }
    Ok(())
}

#[tauri::command]
pub async fn restart_opencode_server(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<u16> {
    println!("[restart_opencode_server] Starting restart...");

    {
        let mut pid_guard = state.opencode_pid.lock().unwrap();
        if let Some(pid) = pid_guard.take() {
            println!("[restart_opencode_server] Killing tracked process {}", pid);
            kill_process(pid);
        }
    }

    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    let new_port = get_free_port();
    *state.opencode_port.lock().unwrap() = Some(new_port);
    println!("[restart_opencode_server] New port: {}", new_port);

    if let Some(cache_path) = dirs::cache_dir().map(|p| p.join("opencode").join("models.json")) {
        if cache_path.exists() {
            println!("[restart_opencode_server] Deleting cache: {:?}", cache_path);
            let _ = fs::remove_file(cache_path);
        }
    }

    start_opencode_server(app, state).await
}

#[tauri::command]
pub fn is_opencode_running(state: tauri::State<'_, AppState>) -> bool {
    state.opencode_pid.lock().unwrap().is_some()
}

/// Check if Bun is installed and get its version
#[tauri::command]
pub async fn check_bun_installation(app: AppHandle) -> BunCheckResult {
    let shell = app.shell();

    match shell.command("bun").args(["--version"]).output().await {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                BunCheckResult {
                    installed: true,
                    version: if version.is_empty() {
                        None
                    } else {
                        Some(version)
                    },
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                BunCheckResult {
                    installed: false,
                    version: None,
                    error: if stderr.is_empty() { None } else { Some(stderr) },
                }
            }
        }
        Err(e) => BunCheckResult {
            installed: false,
            version: None,
            error: Some(format!("Bun not found: {}", e)),
        },
    }
}
