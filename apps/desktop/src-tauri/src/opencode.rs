use crate::error::{AppError, AppResult};
use crate::paths::{get_dilag_dir, get_opencode_config_dir, get_sessions_dir};
use crate::state::AppState;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

/// Mobile design skill content - embedded from assets
const MOBILE_DESIGN_SKILL: &str = include_str!("../assets/mobile-designer-prompt.md");

/// Web design skill content - embedded from assets
const WEB_DESIGN_SKILL: &str = include_str!("../assets/web-designer-prompt.md");

/// Find a free port by binding to port 0
pub fn get_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("Failed to bind to find free port")
        .local_addr()
        .expect("Failed to get local address")
        .port()
}

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

fn get_bun_binary_path() -> Option<PathBuf> {
    let mut candidates = vec![
        PathBuf::from("/opt/homebrew/bin/bun"),
        PathBuf::from("/usr/local/bin/bun"),
        PathBuf::from("/usr/bin/bun"),
    ];

    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".bun/bin/bun"));
    }

    candidates.into_iter().find(|path| path.exists() && path.is_file())
}

fn build_augmented_path() -> String {
    let existing = std::env::var("PATH").unwrap_or_default();
    let separator = if cfg!(windows) { ";" } else { ":" };

    let mut extra_dirs: Vec<PathBuf> = vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ];

    if let Some(home) = dirs::home_dir() {
        extra_dirs.push(home.join(".bun/bin"));
        extra_dirs.push(home.join(".npm-global/bin"));
        extra_dirs.push(home.join(".cargo/bin"));
        extra_dirs.push(home.join(".local/bin"));

        #[cfg(target_os = "macos")]
        extra_dirs.push(home.join("Library/pnpm"));
    }

    let mut seen: HashSet<String> = HashSet::new();
    let mut parts: Vec<String> = Vec::new();

    for dir in extra_dirs {
        if !dir.exists() || !dir.is_dir() {
            continue;
        }
        let dir_str = dir.to_string_lossy().to_string();
        if dir_str.is_empty() {
            continue;
        }
        if seen.insert(dir_str.clone()) {
            parts.push(dir_str);
        }
    }

    for item in existing.split(separator) {
        let item = item.trim();
        if item.is_empty() {
            continue;
        }
        if seen.insert(item.to_string()) {
            parts.push(item.to_string());
        }
    }

    if parts.is_empty() {
        if cfg!(windows) {
            "C:\\Windows\\System32".to_string()
        } else {
            "/usr/bin:/bin:/usr/sbin:/sbin".to_string()
        }
    } else {
        parts.join(separator)
    }
}

fn ensure_config_exists() -> AppResult<()> {
    let config_dir = get_opencode_config_dir();
    fs::create_dir_all(&config_dir)?;

    // Create mobile-design skill directory and file
    let mobile_skill_dir = config_dir.join("skill").join("mobile-design");
    fs::create_dir_all(&mobile_skill_dir)?;
    fs::write(mobile_skill_dir.join("SKILL.md"), MOBILE_DESIGN_SKILL)?;

    // Create web-design skill directory and file
    let web_skill_dir = config_dir.join("skill").join("web-design");
    fs::create_dir_all(&web_skill_dir)?;
    fs::write(web_skill_dir.join("SKILL.md"), WEB_DESIGN_SKILL)?;

    // Create opencode config
    let config_file = config_dir.join("opencode.json");
    let config = serde_json::json!({
        "$schema": "https://opencode.ai/config.json",
        "autoupdate": false,
        "share": "disabled",
        "default_agent": "build",
        "plugin": [
            "opencode-antigravity-auth@1.2.8"
        ],
        "agent": {
            "build": {
                "prompt": "You are a UI design assistant that creates HTML screen prototypes. On your first response, invoke the skill specified in the user's message (either 'mobile-design' or 'web-design'). Write all screens to the screens/ directory as HTML files."
            }
        },
        "permission": {
            "bash": {
                "*": "ask",

                "ls": "allow",
                "ls *": "allow",
                "mkdir *": "allow",
                "pwd": "allow",
                "which *": "allow",
                "echo *": "allow",
                "cat *": "allow",
                "head *": "allow",
                "tail *": "allow",
                "wc *": "allow",
                "find": "allow",
                "find *": "allow",
                "grep *": "allow",
                "file *": "allow",
                "stat *": "allow",
                "tree *": "allow",
                "du *": "allow",
                "df *": "allow",

                "git status": "allow",
                "git status *": "allow",
                "git log": "allow",
                "git log *": "allow",
                "git diff": "allow",
                "git diff *": "allow",
                "git branch": "allow",
                "git branch *": "allow",
                "git show *": "allow",
                "git remote *": "allow",
                "git stash list": "allow",
                "git rev-parse *": "allow",
                "git config --get *": "allow",

                "bun i": "allow",
                "bun install": "allow",
                "bun install *": "allow",
                "bun add *": "allow",
                "bun remove *": "allow",
                "bun run *": "allow",
                "bun pm ls": "allow",
                "bun pm ls *": "allow",
                "bun x *": "allow",
                "bunx *": "allow",

                "npm i": "allow",
                "npm install": "allow",
                "npm install *": "allow",
                "npm ci": "allow",
                "npm run *": "allow",
                "npm ls": "allow",
                "npm ls *": "allow",
                "npm list": "allow",
                "npm list *": "allow",
                "npx *": "allow",

                "tsc": "allow",
                "tsc *": "allow",
                "vitest *": "allow",
                "jest *": "allow",
                "eslint *": "allow",
                "prettier *": "allow"
            },
            "task": "deny",
            "skill": {
                "mobile-design": "allow",
                "web-design": "allow"
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
    let augmented_path = build_augmented_path();
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
        .env("PATH", augmented_path)
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

#[derive(Debug, Clone, Serialize)]
pub struct InstallProgress {
    pub stage: String,
    pub message: String,
    pub completed: bool,
    pub error: Option<String>,
}

/// Install OpenCode and Bun using their official install scripts
#[tauri::command]
pub async fn install_dependencies(app: AppHandle) -> Result<InstallProgress, String> {
    let shell = app.shell();

    // First install Bun
    let bun_install = shell
        .command("bash")
        .args(["-c", "curl -fsSL https://bun.sh/install | bash"])
        .output()
        .await;

    match bun_install {
        Ok(output) if !output.status.success() => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Ok(InstallProgress {
                stage: "bun".to_string(),
                message: "Failed to install Bun".to_string(),
                completed: false,
                error: Some(stderr),
            });
        }
        Err(e) => {
            return Ok(InstallProgress {
                stage: "bun".to_string(),
                message: "Failed to install Bun".to_string(),
                completed: false,
                error: Some(e.to_string()),
            });
        }
        _ => {}
    }

    // Then install OpenCode
    let opencode_install = shell
        .command("bash")
        .args(["-c", "curl -fsSL https://opencode.ai/install | bash"])
        .output()
        .await;

    match opencode_install {
        Ok(output) if !output.status.success() => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Ok(InstallProgress {
                stage: "opencode".to_string(),
                message: "Failed to install OpenCode".to_string(),
                completed: false,
                error: Some(stderr),
            });
        }
        Err(e) => {
            return Ok(InstallProgress {
                stage: "opencode".to_string(),
                message: "Failed to install OpenCode".to_string(),
                completed: false,
                error: Some(e.to_string()),
            });
        }
        _ => {}
    }

    Ok(InstallProgress {
        stage: "complete".to_string(),
        message: "All dependencies installed successfully".to_string(),
        completed: true,
        error: None,
    })
}

/// Check if Bun is installed and get its version
#[tauri::command]
pub async fn check_bun_installation(app: AppHandle) -> BunCheckResult {
    let shell = app.shell();
    let augmented_path = build_augmented_path();

    let command = if let Some(bun_path) = get_bun_binary_path() {
        shell.command(bun_path)
    } else {
        shell.command("bun")
    };

    match command
        .env("PATH", augmented_path)
        .args(["--version"])
        .output()
        .await
    {
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
