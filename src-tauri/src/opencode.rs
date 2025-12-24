use crate::error::{AppError, AppResult};
use crate::paths::{get_dilag_dir, get_opencode_config_dir, get_sessions_dir};
use crate::state::AppState;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

pub const OPENCODE_PORT: u16 = 4096;

/// The designer agent system prompt, loaded from assets at compile time
pub const DESIGNER_AGENT_PROMPT: &str = include_str!("../assets/designer-prompt.md");

#[derive(Debug, Serialize)]
pub struct OpenCodeCheckResult {
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

/// Ensure the OpenCode config file exists with our designer agent
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
                "description": "UI design agent for creating production-grade screens",
                "tools": {
                    "bash": false
                }
            }
        }
    });

    let config_str = serde_json::to_string_pretty(&config)?;
    fs::write(&config_file, config_str)?;

    Ok(())
}

/// Kill a process by PID
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

/// Check if a port is currently in use
fn is_port_in_use(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_err()
}

/// Find and kill any process listening on the OpenCode port
fn kill_opencode_on_port() {
    #[cfg(unix)]
    {
        if let Ok(output) = std::process::Command::new("lsof")
            .args(["-ti", &format!(":{}", OPENCODE_PORT)])
            .output()
        {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid_str in pids.lines() {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    println!(
                        "[kill_opencode_on_port] Killing PID {} on port {}",
                        pid, OPENCODE_PORT
                    );
                    unsafe {
                        if libc::kill(pid, 0) == 0 {
                            libc::kill(pid, libc::SIGTERM);
                        }
                    }
                }
            }
        }
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("cmd")
            .args([
                "/C",
                &format!(
                    "for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :{} ^| findstr LISTENING') do taskkill /F /PID %a",
                    OPENCODE_PORT
                ),
            ])
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
pub fn get_opencode_port() -> u16 {
    OPENCODE_PORT
}

#[tauri::command]
pub async fn start_opencode_server(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<u16> {
    // Check if we already have a tracked process
    if state.opencode_pid.lock().unwrap().is_some() {
        return Ok(OPENCODE_PORT);
    }

    // Kill any existing process on the port
    kill_opencode_on_port();
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Ensure directories and config exist
    fs::create_dir_all(get_sessions_dir())?;
    ensure_config_exists()?;

    // Find opencode binary
    let opencode_path =
        get_opencode_binary_path().ok_or(AppError::OpenCodeNotFound)?;

    // Spawn server with isolated config
    let shell = app.shell();
    let dilag_dir = get_dilag_dir();
    println!(
        "[start_opencode_server] Starting with XDG_CONFIG_HOME={:?}",
        dilag_dir
    );

    let (_rx, child) = shell
        .command(&opencode_path)
        .args([
            "serve",
            "--port",
            &OPENCODE_PORT.to_string(),
            "--hostname",
            "127.0.0.1",
        ])
        .env("XDG_CONFIG_HOME", dilag_dir.to_string_lossy().to_string())
        .spawn()
        .map_err(|e| AppError::ServerStart(e.to_string()))?;

    *state.opencode_pid.lock().unwrap() = Some(child.pid());

    // Give server time to start
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(OPENCODE_PORT)
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

    // Stop the server first
    {
        let mut pid_guard = state.opencode_pid.lock().unwrap();
        if let Some(pid) = pid_guard.take() {
            println!("[restart_opencode_server] Killing tracked process {}", pid);
            kill_process(pid);
        }
    }

    kill_opencode_on_port();

    // Wait for port to be released
    println!("[restart_opencode_server] Waiting for port to be released...");
    for _ in 0..20 {
        tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
        if !is_port_in_use(OPENCODE_PORT) {
            break;
        }
    }

    // Clear models cache
    if let Some(cache_path) = dirs::cache_dir().map(|p| p.join("opencode").join("models.json")) {
        if cache_path.exists() {
            println!("[restart_opencode_server] Deleting cache: {:?}", cache_path);
            let _ = fs::remove_file(cache_path);
        }
    }

    println!("[restart_opencode_server] Starting server...");
    start_opencode_server(app, state).await
}

#[tauri::command]
pub fn is_opencode_running(state: tauri::State<'_, AppState>) -> bool {
    state.opencode_pid.lock().unwrap().is_some()
}
