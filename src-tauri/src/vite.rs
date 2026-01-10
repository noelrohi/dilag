use crate::error::{AppError, AppResult};
use crate::opencode::VITE_PORT;
use crate::state::AppState;
use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

/// File node for the project file tree
#[derive(Debug, Serialize, Clone)]
pub struct FileNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

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
    *state.vite_session_cwd.lock().unwrap() = Some(session_cwd.clone());

    // Clone app handle for use in the async task
    let app_handle = app.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line).to_string();
                    println!("[vite stdout] {}", text);
                    let _ = app_handle.emit("vite:stdout", &text);
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line).to_string();
                    println!("[vite stderr] {}", text);
                    // Emit as error if it contains error keywords
                    if text.to_lowercase().contains("error") {
                        let _ = app_handle.emit("vite:error", &text);
                    }
                    let _ = app_handle.emit("vite:stderr", &text);
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    println!("[vite] Process terminated with code: {:?}", payload.code);
                    let _ = app_handle.emit("vite:terminated", payload.code);
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

#[tauri::command]
pub async fn stop_vite_server(state: tauri::State<'_, AppState>) -> AppResult<()> {
    let mut pid_guard = state.vite_pid.lock().unwrap();
    if let Some(pid) = pid_guard.take() {
        println!("[stop_vite_server] Killing Vite process {}", pid);
        kill_process(pid);
    }
    *state.vite_session_cwd.lock().unwrap() = None;

    kill_vite_on_port();

    Ok(())
}

#[tauri::command]
pub fn get_vite_status(state: tauri::State<'_, AppState>) -> ViteStatus {
    let pid = *state.vite_pid.lock().unwrap();
    let session_cwd = state.vite_session_cwd.lock().unwrap().clone();
    let running = pid.is_some() && is_port_in_use(VITE_PORT);

    ViteStatus {
        running,
        pid,
        port: VITE_PORT,
        session_cwd,
    }
}

/// Get the Vite port constant
#[tauri::command]
pub fn get_vite_port() -> u16 {
    VITE_PORT
}

fn has_project_files(cwd: &Path) -> bool {
    // Consider a project "has files" if there's any non-ignored file besides package.json.
    // This is used for UI state, so prefer avoiding false negatives.
    const IGNORE_DIRS: [&str; 6] = ["node_modules", ".git", "dist", ".next", "target", ".turbo"];
    const IGNORE_FILES: [&str; 3] = ["package.json", "bun.lockb", ".DS_Store"];

    let mut stack: Vec<std::path::PathBuf> = vec![cwd.to_path_buf()];
    let mut visited: usize = 0;

    while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name();
            let name = name.to_string_lossy();

            if path.is_dir() {
                if IGNORE_DIRS.contains(&name.as_ref()) {
                    continue;
                }
                stack.push(path);
                continue;
            }

            if path.is_file() && !IGNORE_FILES.contains(&name.as_ref()) {
                return true;
            }

            visited += 1;
            // Avoid pathological scans; if we see lots of entries,
            // assume the project exists to prevent the UI from getting stuck.
            if visited > 5000 {
                return true;
            }
        }
    }

    false
}

#[tauri::command]
pub fn check_project_ready(session_cwd: String) -> bool {
    let cwd = Path::new(&session_cwd);
    cwd.join("package.json").exists()
}

#[tauri::command]
pub fn check_project_has_files(session_cwd: String) -> bool {
    let cwd = Path::new(&session_cwd);
    if !cwd.join("package.json").exists() {
        return false;
    }
    has_project_files(cwd)
}

/// Directories and files to ignore when listing project files
const TREE_IGNORE_DIRS: [&str; 8] = [
    "node_modules",
    ".git",
    "dist",
    ".next",
    "target",
    ".turbo",
    ".vite",
    "build",
];
const TREE_IGNORE_FILES: [&str; 3] = ["bun.lockb", ".DS_Store", "thumbs.db"];

/// Recursively build a file tree from a directory
fn build_file_tree(dir: &Path, base_path: &Path) -> Vec<FileNode> {
    let mut nodes: Vec<FileNode> = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return nodes,
    };

    let mut items: Vec<_> = entries.flatten().collect();
    // Sort: directories first, then alphabetically
    items.sort_by(|a, b| {
        let a_is_dir = a.path().is_dir();
        let b_is_dir = b.path().is_dir();
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip ignored directories
        if path.is_dir() && TREE_IGNORE_DIRS.contains(&name.as_str()) {
            continue;
        }

        // Skip ignored files
        if path.is_file() && TREE_IGNORE_FILES.contains(&name.to_lowercase().as_str()) {
            continue;
        }

        // Skip hidden files/dirs (starting with .)
        if name.starts_with('.') {
            continue;
        }

        let relative_path = path
            .strip_prefix(base_path)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            let children = build_file_tree(&path, base_path);
            nodes.push(FileNode {
                id: relative_path,
                name,
                is_dir: true,
                children: Some(children),
            });
        } else {
            nodes.push(FileNode {
                id: relative_path,
                name,
                is_dir: false,
                children: None,
            });
        }
    }

    nodes
}

/// List all project files as a tree structure
#[tauri::command]
pub fn list_project_files(session_cwd: String) -> AppResult<Vec<FileNode>> {
    let cwd = Path::new(&session_cwd);
    if !cwd.exists() {
        return Err(AppError::Custom(format!(
            "Session directory does not exist: {}",
            session_cwd
        )));
    }

    Ok(build_file_tree(cwd, cwd))
}

/// Read a file's content from the project
#[tauri::command]
pub fn read_project_file(session_cwd: String, file_path: String) -> AppResult<String> {
    let cwd = Path::new(&session_cwd);
    let full_path = cwd.join(&file_path);

    // Security: ensure the file is within the session directory
    let canonical_cwd = cwd.canonicalize().map_err(|e| {
        AppError::Custom(format!("Failed to resolve session directory: {}", e))
    })?;
    let canonical_file = full_path.canonicalize().map_err(|e| {
        AppError::Custom(format!("Failed to resolve file path: {}", e))
    })?;

    if !canonical_file.starts_with(&canonical_cwd) {
        return Err(AppError::Custom(
            "Access denied: file is outside session directory".to_string(),
        ));
    }

    std::fs::read_to_string(&canonical_file).map_err(|e| {
        AppError::Custom(format!("Failed to read file: {}", e))
    })
}
