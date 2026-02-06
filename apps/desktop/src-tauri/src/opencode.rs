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

// =============================================================================
// Skills Commands
// =============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub path: String,
    pub is_symlink: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillPreview {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillPreviewResult {
    pub success: bool,
    pub skills: Vec<SkillPreview>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillInstallResult {
    pub success: bool,
    pub installed: Vec<String>,
    pub error: Option<String>,
}

/// Strip ANSI escape codes from a string.
/// Handles CSI sequences (ESC [ ... letter), OSC sequences (ESC ] ... BEL/ST),
/// and two-character escape sequences (ESC + single char).
fn strip_ansi(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            match chars.peek() {
                // CSI sequence: ESC [ ... (letter)
                Some(&'[') => {
                    chars.next();
                    while let Some(&next) = chars.peek() {
                        chars.next();
                        if next.is_ascii_alphabetic() {
                            break;
                        }
                    }
                }
                // OSC sequence: ESC ] ... (BEL or ST)
                Some(&']') => {
                    chars.next();
                    while let Some(&next) = chars.peek() {
                        chars.next();
                        // BEL terminates OSC
                        if next == '\x07' {
                            break;
                        }
                        // ST (ESC \) terminates OSC
                        if next == '\x1b' {
                            if chars.peek() == Some(&'\\') {
                                chars.next();
                            }
                            break;
                        }
                    }
                }
                // Two-character sequences: ESC ( , ESC ) , ESC # , etc.
                Some(&ch) if ch == '(' || ch == ')' || ch == '#' || ch == '>' || ch == '=' => {
                    chars.next();
                    // Some of these have a parameter character after
                    if ch == '(' || ch == ')' || ch == '#' {
                        chars.next(); // consume the parameter
                    }
                }
                // Unknown ESC sequence - skip the ESC
                _ => {}
            }
        } else if c == '\r' || c == '\u{25cf}' || c == '\u{25c7}' || c == '\u{25c6}' {
            // Skip carriage returns and clack/prompts marker chars (●◇◆)
            continue;
        } else {
            result.push(c);
        }
    }
    result
}

/// Parse the output of `npx skills add <source> -l` into skill name/description pairs.
fn parse_skill_list(raw_output: &str) -> Vec<SkillPreview> {
    let clean = strip_ansi(raw_output);
    let mut skills = Vec::new();
    let mut in_skills_section = false;
    let mut current_name: Option<String> = None;
    let mut current_desc = String::new();

    for line in clean.lines() {
        let trimmed = line.trim();

        if trimmed.contains("Available Skills") {
            in_skills_section = true;
            continue;
        }

        if !in_skills_section {
            continue;
        }

        // End marker
        if trimmed.starts_with("Use --skill") || trimmed.starts_with("└") {
            break;
        }

        if trimmed.is_empty() || trimmed == "│" || trimmed == "|" {
            continue;
        }

        // Strip leading │ or | characters
        let content = trimmed
            .trim_start_matches('│')
            .trim_start_matches('|')
            .trim();

        if content.is_empty() {
            continue;
        }

        // Skill names are short alphanumeric identifiers with hyphens/underscores
        if content.len() < 80 && content.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            // Save previous skill
            if let Some(name) = current_name.take() {
                skills.push(SkillPreview {
                    name,
                    description: current_desc.trim().to_string(),
                });
                current_desc.clear();
            }
            current_name = Some(content.to_string());
        } else if current_name.is_some() {
            // This is a description line
            if !current_desc.is_empty() {
                current_desc.push(' ');
            }
            current_desc.push_str(content);
        }
    }

    // Save last skill
    if let Some(name) = current_name {
        skills.push(SkillPreview {
            name,
            description: current_desc.trim().to_string(),
        });
    }

    skills
}

/// List installed skills by reading both OpenCode skill directories.
/// Checks `skill/` (OpenCode native) and `skills/` (skills.sh CLI convention).
#[tauri::command]
pub fn list_installed_skills() -> AppResult<Vec<SkillInfo>> {
    let config_dir = get_opencode_config_dir();
    let mut skills = Vec::new();
    let mut seen = HashSet::new();

    for dir_name in &["skill", "skills"] {
        let skill_dir = config_dir.join(dir_name);
        if !skill_dir.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&skill_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let is_symlink = entry.file_type().map(|ft| ft.is_symlink()).unwrap_or(false);
                if path.is_dir() || is_symlink {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if seen.insert(name.to_string()) {
                            skills.push(SkillInfo {
                                name: name.to_string(),
                                path: path.to_string_lossy().to_string(),
                                is_symlink,
                            });
                        }
                    }
                }
            }
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

/// Validate that a skill source string is a safe owner/repo pattern or URL.
fn validate_skill_source(source: &str) -> AppResult<()> {
    if source.is_empty() {
        return Err(AppError::Custom("Skill source cannot be empty".to_string()));
    }
    if source.starts_with('-') {
        return Err(AppError::Custom(format!("Invalid skill source: {}", source)));
    }
    // Allow owner/repo patterns and URLs
    let is_valid = source.chars().all(|c| {
        c.is_alphanumeric() || matches!(c, '/' | '-' | '_' | '.' | ':' | '@')
    });
    if !is_valid {
        return Err(AppError::Custom(format!("Invalid skill source: {}", source)));
    }
    Ok(())
}

/// Preview available skills from a source without installing.
/// Runs `npx -y skills add <source> -l` and parses the output.
#[tauri::command]
pub async fn preview_skills(app: AppHandle, source: String) -> AppResult<SkillPreviewResult> {
    validate_skill_source(&source)?;

    let shell = app.shell();
    let augmented_path = build_augmented_path();

    let output = shell
        .command("npx")
        .args(["-y", "skills", "add", &source, "-l"])
        .env("PATH", augmented_path)
        .output()
        .await
        .map_err(|e| AppError::Custom(format!("Failed to run npx: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        let skills = parse_skill_list(&stdout);
        Ok(SkillPreviewResult {
            success: true,
            skills,
            error: None,
        })
    } else {
        Ok(SkillPreviewResult {
            success: false,
            skills: vec![],
            error: Some(if stderr.is_empty() {
                stdout
            } else {
                stderr
            }),
        })
    }
}

/// Install specific skills from a source.
/// Runs `npx -y skills add <source> -s <name> -g -y -a opencode` for each skill.
/// After install, syncs skills into `~/.dilag/opencode/skill/` via symlinks.
#[tauri::command]
pub async fn install_skill(
    app: AppHandle,
    source: String,
    skill_names: Vec<String>,
) -> AppResult<SkillInstallResult> {
    validate_skill_source(&source)?;
    for name in &skill_names {
        if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err(AppError::Custom(format!("Invalid skill name: {}", name)));
        }
    }

    let shell = app.shell();
    let augmented_path = build_augmented_path();

    // Build args: -s name1 -s name2 ...
    let mut args = vec![
        "-y".to_string(),
        "skills".to_string(),
        "add".to_string(),
        source,
    ];
    for name in &skill_names {
        args.push("-s".to_string());
        args.push(name.clone());
    }
    args.extend(["-g".to_string(), "-y".to_string(), "-a".to_string(), "opencode".to_string()]);

    let output = shell
        .command("npx")
        .args(args.iter().map(|s| s.as_str()).collect::<Vec<_>>())
        .env("PATH", augmented_path)
        .output()
        .await
        .map_err(|e| AppError::Custom(format!("Failed to run npx: {}", e)))?;

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        sync_canonical_skills()?;

        // Verify which skills were actually installed on disk
        let config_dir = get_opencode_config_dir();
        let actually_installed: Vec<String> = skill_names
            .into_iter()
            .filter(|name| {
                ["skill", "skills"]
                    .iter()
                    .any(|dir| config_dir.join(dir).join(name).exists())
            })
            .collect();

        Ok(SkillInstallResult {
            success: true,
            installed: actually_installed,
            error: None,
        })
    } else {
        Ok(SkillInstallResult {
            success: false,
            installed: vec![],
            error: Some(if stderr.is_empty() {
                "Installation failed".to_string()
            } else {
                stderr
            }),
        })
    }
}

/// Sync skills from the canonical `~/.agents/skills/` directory into
/// `~/.dilag/opencode/skill/` by creating symlinks for any missing skills.
fn sync_canonical_skills() -> AppResult<()> {
    let home = dirs::home_dir().ok_or(AppError::Custom("No home directory".to_string()))?;
    let canonical_dir = home.join(".agents").join("skills");
    let target_dir = get_opencode_config_dir().join("skill");

    if !canonical_dir.exists() {
        return Ok(());
    }

    fs::create_dir_all(&target_dir)?;

    if let Ok(entries) = fs::read_dir(&canonical_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            if let Some(name) = path.file_name() {
                let dest = target_dir.join(name);
                if !dest.exists() {
                    #[cfg(unix)]
                    {
                        std::os::unix::fs::symlink(&path, &dest)?;
                    }
                    #[cfg(windows)]
                    {
                        std::os::windows::fs::symlink_dir(&path, &dest)?;
                    }
                }
            }
        }
    }

    Ok(())
}

/// Remove an installed skill. Handles both symlinks (just remove the link)
/// and real directories (remove recursively).
#[tauri::command]
pub fn remove_skill(skill_name: String) -> AppResult<()> {
    let config_dir = get_opencode_config_dir();
    for dir_name in &["skill", "skills"] {
        let skill_path = config_dir.join(dir_name).join(&skill_name);
        if let Ok(meta) = skill_path.symlink_metadata() {
            if meta.file_type().is_symlink() {
                fs::remove_file(&skill_path)?;
            } else if skill_path.is_dir() {
                fs::remove_dir_all(&skill_path)?;
            }
        }
    }
    Ok(())
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
