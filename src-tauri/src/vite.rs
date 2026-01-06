use crate::error::{AppError, AppResult};
use crate::opencode::VITE_PORT;
use crate::state::AppState;
use serde::Serialize;
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize)]
pub struct ViteStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub port: u16,
    pub session_cwd: Option<String>,
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

/// Find and kill any process listening on the Vite port
fn kill_vite_on_port() {
    #[cfg(unix)]
    {
        if let Ok(output) = std::process::Command::new("lsof")
            .args(["-ti", &format!(":{}", VITE_PORT)])
            .output()
        {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid_str in pids.lines() {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    println!(
                        "[kill_vite_on_port] Killing PID {} on port {}",
                        pid, VITE_PORT
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
                    VITE_PORT
                ),
            ])
            .output();
    }
}

fn is_port_in_use(port: u16) -> bool {
    let ipv4_in_use = std::net::TcpListener::bind(("127.0.0.1", port)).is_err();
    let ipv6_in_use = std::net::TcpListener::bind(("::1", port)).is_err();
    ipv4_in_use || ipv6_in_use
}

fn find_bun_path() -> Option<String> {
    let common_paths = [
        "/opt/homebrew/bin/bun",
        "/usr/local/bin/bun",
        "/usr/bin/bun",
        &format!("{}/.bun/bin/bun", std::env::var("HOME").unwrap_or_default()),
    ];

    for path in &common_paths {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    if let Ok(output) = std::process::Command::new("which").arg("bun").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && Path::new(&path).exists() {
                return Some(path);
            }
        }
    }

    None
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Start the Vite dev server for a session's web project
/// Runs `bun install` if node_modules doesn't exist, then `bun run dev`
#[tauri::command]
pub async fn start_vite_server(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    session_cwd: String,
) -> AppResult<u16> {
    // Check if we already have a tracked process
    if state.vite_pid.lock().unwrap().is_some() {
        return Ok(VITE_PORT);
    }

    // Kill any existing process on the port
    kill_vite_on_port();
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    let cwd = Path::new(&session_cwd);
    if !cwd.exists() {
        return Err(AppError::Custom(format!(
            "Session directory does not exist: {}",
            session_cwd
        )));
    }

    // Check if package.json exists
    let package_json = cwd.join("package.json");
    if !package_json.exists() {
        return Err(AppError::Custom(format!(
            "No package.json found in {}",
            session_cwd
        )));
    }

    let shell = app.shell();

    let bun_path = find_bun_path().ok_or_else(|| {
        AppError::Custom("bun not found in PATH or common locations".to_string())
    })?;

    let node_modules = cwd.join("node_modules");
    if !node_modules.exists() {
        println!(
            "[start_vite_server] Running bun install in {:?}",
            session_cwd
        );

        let install_output = shell
            .command(&bun_path)
            .args(["install"])
            .current_dir(&cwd)
            .output()
            .await
            .map_err(|e| AppError::Custom(format!("Failed to run bun install: {}", e)))?;

        if !install_output.status.success() {
            let stderr = String::from_utf8_lossy(&install_output.stderr);
            return Err(AppError::Custom(format!("bun install failed: {}", stderr)));
        }

        println!("[start_vite_server] bun install completed successfully");
    }

    println!(
        "[start_vite_server] Starting Vite on port {} in {:?}",
        VITE_PORT, session_cwd
    );
    println!("[start_vite_server] Using bun at: {}", bun_path);

    let (mut rx, child) = shell
        .command(&bun_path)
        .args(["run", "dev", "--port", &VITE_PORT.to_string()])
        .current_dir(&cwd)
        .spawn()
        .map_err(|e| AppError::Custom(format!("Failed to start Vite: {}", e)))?;

    let pid = child.pid();
    println!("[start_vite_server] Spawned process with PID: {}", pid);
    *state.vite_pid.lock().unwrap() = Some(pid);

    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    println!("[vite stdout] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    println!("[vite stderr] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    println!("[vite] Process terminated with code: {:?}", payload.code);
                }
                _ => {}
            }
        }
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(3000)).await;

    if !is_port_in_use(VITE_PORT) {
        *state.vite_pid.lock().unwrap() = None;
        return Err(AppError::Custom(
            "Vite server failed to start - port not in use after 3s".to_string(),
        ));
    }

    println!("[start_vite_server] Vite server started successfully on port {}", VITE_PORT);
    Ok(VITE_PORT)
}

/// Stop the Vite dev server
#[tauri::command]
pub async fn stop_vite_server(state: tauri::State<'_, AppState>) -> AppResult<()> {
    let mut pid_guard = state.vite_pid.lock().unwrap();
    if let Some(pid) = pid_guard.take() {
        println!("[stop_vite_server] Killing Vite process {}", pid);
        kill_process(pid);
    }

    // Also kill any orphaned process on the port
    kill_vite_on_port();

    Ok(())
}

/// Get the current status of the Vite dev server
#[tauri::command]
pub fn get_vite_status(state: tauri::State<'_, AppState>) -> ViteStatus {
    let pid = *state.vite_pid.lock().unwrap();
    let running = pid.is_some() && is_port_in_use(VITE_PORT);

    ViteStatus {
        running,
        pid,
        port: VITE_PORT,
    }
}

/// Get the Vite port constant
#[tauri::command]
pub fn get_vite_port() -> u16 {
    VITE_PORT
}

#[tauri::command]
pub fn check_project_ready(session_cwd: String) -> bool {
    let cwd = Path::new(&session_cwd);
    cwd.join("package.json").exists()
}
