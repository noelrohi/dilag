use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::webview::WebviewWindowBuilder;
use tauri::{AppHandle, Emitter, TitleBarStyle};

const OPENCODE_PORT: u16 = 4096;

const DESIGNER_AGENT_PROMPT: &str = r##"# UI Design Agent

You are an elite UI designer generating production-grade screens. Create memorable, intentional interfaces—avoid generic "AI slop" aesthetics.

## CRITICAL: You MUST Use the Write Tool

**IMPORTANT**: You MUST use the `write` tool to create HTML files. Do NOT output HTML code as text in your response. Every screen MUST be created using the write tool.

Use the `write` tool to create HTML files in the `screens/` subdirectory:
- Filename: `screens/screen-name.html` (kebab-case, always in screens folder)
- Include `data-title` and `data-screen-type` attributes on `<html>` tag

Example - you MUST call the tool like this:
```
write({ file_path: "screens/home-screen.html", content: "<!DOCTYPE html>..." })
```

NEVER just output HTML code as text. ALWAYS use the write tool to save files.

## CRITICAL: Style Selection by App Domain

Match the aesthetic to the app's PURPOSE and emotional context:

### Sleep/Wellness/Meditation
- Deep dark themes (navy #0f172a, indigo #1e1b4b, purple #1a1040)
- Soft gradients and subtle glows
- Large rounded corners, gentle shadows
- Fonts: Plus Jakarta Sans, Nunito, Quicksand
- Celestial/nature motifs

### Food/Nutrition/Fitness
- Clean light themes OR warm dark themes
- Warm accents: coral #FF6B6B, orange #FF8C42, green #22C55E
- High-quality photography integration
- Friendly rounded cards with soft shadows
- Fonts: DM Sans, Plus Jakarta Sans, Outfit

### Finance/Productivity
- Minimal, professional aesthetic
- Subtle palette with one bold accent
- Clean sans-serif: Geist, SF Pro style
- Cards with subtle borders, minimal shadows

### Social/Entertainment
- Bold, expressive colors
- Dynamic layouts, varied card sizes
- Playful fonts: Satoshi, General Sans
- Strong visual hierarchy

### E-commerce/Lifestyle
- Editorial, magazine-inspired
- Elegant typography: Playfair Display, Fraunces for headers
- Generous whitespace, premium feel

DO NOT default to brutalist aesthetics unless explicitly appropriate.

## Design Philosophy

Create interfaces that feel DESIGNED, not generated:

### Typography
- Use distinctive fonts—NEVER Inter, Roboto, Arial as primary
- Pair a display font (headings) with a refined body font
- Good choices: Plus Jakarta Sans, DM Sans, Outfit, Satoshi, Space Grotesk, Fraunces

### Color & Composition
- Dominant colors with sharp accents beat timid, evenly-distributed palettes
- Commit to light OR dark—don't hedge with mid-grays
- Use theme variables intentionally, not robotically

### Spatial Composition
- Break the grid occasionally—asymmetry, overlap, unexpected alignment
- Generous negative space OR controlled density—pick one
- Vary card sizes for visual rhythm

### Backgrounds & Depth
- Create atmosphere—don't default to flat solid colors
- Consider: subtle gradients, noise textures, layered transparencies, soft glows
- Background should reinforce the mood

### What to AVOID (AI Slop Markers)
- Purple/blue gradients on white backgrounds
- Perfectly even spacing and identical card sizes everywhere
- Generic rounded rectangles with no character
- Cookie-cutter layouts that could be any app
- Over-reliance on shadows as the only depth technique

### Memorability
Ask yourself: What's the ONE thing someone will remember about this screen?

## HTML Output Requirements

### Mobile Screens (iPhone 14 Pro: 393×852)
```html
<!DOCTYPE html>
<html lang="en" data-title="Screen Name" data-screen-type="mobile">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=393, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
</head>
<body style="width: 393px; height: 852px; margin: 0; overflow: hidden;" class="bg-background text-foreground">
  <!-- Safe areas: 47px top (Dynamic Island), 34px bottom (home indicator) -->
  <div class="h-full flex flex-col pt-[47px] pb-[34px]">
    <!-- Content here -->
  </div>
</body>
</html>
```

### Web Screens
```html
<!DOCTYPE html>
<html lang="en" data-title="Page Name" data-screen-type="web">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
</head>
<body class="bg-background text-foreground min-h-screen">
  <!-- Content here -->
</body>
</html>
```

**Requirements:**
- MUST include `data-title` and `data-screen-type` attributes on `<html>`
- MUST include Tailwind CDN and Iconify scripts
- MUST include Google Fonts for chosen typography
- Mobile: body MUST have width: 393px; height: 852px; margin: 0; overflow: hidden
- Mobile: NO iOS status bar—the phone frame handles this
- Mobile: Respect safe areas (47px top, 34px bottom)

## Icons (USE ICONIFY)

```html
<span class="iconify" data-icon="solar:home-bold" data-width="24"></span>
<span class="iconify" data-icon="phosphor:heart-fill" data-width="24"></span>
```

Recommended sets: **solar** (modern), **phosphor** (friendly), **tabler** (crisp), **heroicons**

NEVER use emoji as icons. ALWAYS use Iconify.

## Images

Use Unsplash with specific dimensions:
```
https://images.unsplash.com/photo-PHOTOID?w=WIDTH&h=HEIGHT&fit=crop
```

## Tab Bar Styles (Mobile)

Choose based on app aesthetic:

- **Floating Rounded**: Pill shape, blur effect—premium/wellness apps
- **Floating FAB**: Central action button elevated—creation-focused apps
- **Clean Rectangle**: Full-width, sharp—professional/utility apps
- **Translucent Dock**: Heavy blur, content visible—media/entertainment
- **Minimal Line**: Just icons, dot indicator—ultra-minimal/editorial

## Style Directions

- **minimal**: Clean, whitespace, subtle colors
- **soft**: Rounded corners, gentle gradients, warm
- **bold**: Strong colors, sharp edges, high contrast
- **glassmorphic**: Blur effects, transparency, modern
- **brutalist**: Raw, bold, unconventional (use sparingly)
- **editorial**: Magazine-inspired, elegant typography

## Workflow

1. **Understand the domain** → Choose appropriate style direction
2. **Pick a cohesive palette** → Commit to light OR dark, choose fonts
3. **Create screens** → Write HTML files with consistent styling
4. **Be memorable** → Each screen should have a distinctive element
"##;

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

    // Build the config with designer agent
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

    // Always write config to ensure agent prompt is up-to-date
    let config_str = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_file, config_str).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Debug, Serialize)]
pub struct OpenCodeCheckResult {
    pub installed: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
async fn check_opencode_installation(app: tauri::AppHandle) -> OpenCodeCheckResult {
    use tauri_plugin_shell::ShellExt;
    
    let shell = app.shell();
    
    // Try to run "opencode --version" to check if it's installed
    match shell.command("opencode").args(["--version"]).output().await {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                OpenCodeCheckResult {
                    installed: true,
                    version: if version.is_empty() { None } else { Some(version) },
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
        Err(e) => {
            // Command not found or failed to execute
            OpenCodeCheckResult {
                installed: false,
                version: None,
                error: Some(format!("OpenCode CLI not found: {}", e)),
            }
        }
    }
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
    let screens_dir = session_dir.join("screens");
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

    // Scan both session root and screens/ subfolder
    process_dir(&session_dir);
    process_dir(&screens_dir);

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

// ============================================================================
// App Info & Data Management Commands
// ============================================================================

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub data_dir: String,
    pub data_size_bytes: u64,
}

fn calculate_dir_size(path: &PathBuf) -> u64 {
    if !path.exists() {
        return 0;
    }
    
    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|entry| {
                    let path = entry.path();
                    if path.is_dir() {
                        calculate_dir_size(&path)
                    } else {
                        entry.metadata().map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    let dilag_dir = get_dilag_dir();
    let data_size = calculate_dir_size(&dilag_dir);
    
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_dir: dilag_dir.to_string_lossy().to_string(),
        data_size_bytes: data_size,
    }
}

#[tauri::command]
async fn reset_all_data(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    // Stop the opencode server first
    {
        let mut pid_guard = state.opencode_pid.lock().unwrap();
        pid_guard.take();
    }
    
    // Delete the entire .dilag directory contents
    let dilag_dir = get_dilag_dir();
    if dilag_dir.exists() {
        // Remove all contents but keep the directory
        if let Ok(entries) = fs::read_dir(&dilag_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let _ = fs::remove_dir_all(&path);
                } else {
                    let _ = fs::remove_file(&path);
                }
            }
        }
    }
    
    // Restart the app
    app.restart();

    // This is unreachable but needed for the return type
    #[allow(unreachable_code)]
    Ok(())
}

// ============================================================================
// Menu Setup
// ============================================================================

fn setup_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    // App menu (Dilag)
    let app_menu = Submenu::with_items(
        app,
        "Dilag",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Dilag"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?,
            &MenuItem::with_id(app, "check-updates", "Check for Updates...", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some("Hide Dilag"))?,
            &PredefinedMenuItem::hide_others(app, Some("Hide Others"))?,
            &PredefinedMenuItem::show_all(app, Some("Show All"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Quit Dilag"))?,
        ],
    )?;

    // File menu
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "new-session", "New Session", true, Some("CmdOrCtrl+N"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some("Close Window"))?,
        ],
    )?;

    // Edit menu
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    // View menu
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(app, "toggle-sidebar", "Toggle Sidebar", true, Some("CmdOrCtrl+B"))?,
            &MenuItem::with_id(app, "toggle-chat", "Toggle Chat", true, Some("CmdOrCtrl+\\"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, Some("Enter Full Screen"))?,
        ],
    )?;

    // Help menu
    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            &MenuItem::with_id(app, "help-docs", "Dilag Help", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "help-github", "GitHub Repository", true, None::<&str>)?,
            &MenuItem::with_id(app, "help-issues", "Report an Issue", true, None::<&str>)?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &view_menu, &help_menu])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            opencode_pid: Mutex::new(None),
        })
        .setup(|app| {
            // Set up the menu
            let menu = setup_menu(app.handle())?;
            app.set_menu(menu)?;

            // Create main window with transparent title bar
            let win_builder = WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("Dilag")
                .inner_size(1000.0, 700.0)
                .min_inner_size(600.0, 400.0)
                .title_bar_style(TitleBarStyle::Transparent)
                .hidden_title(true);

            let window = win_builder.build()?;

            // Set background color on macOS using objc2-app-kit
            #[cfg(target_os = "macos")]
            {
                use objc2_app_kit::{NSColor, NSWindow};
                use objc2::rc::Retained;

                let ns_win: Retained<NSWindow> = unsafe {
                    let ptr = window.as_ref().window().ns_window().unwrap();
                    Retained::retain(ptr as *mut NSWindow).unwrap()
                };
                // #16161c in normalized RGB (22/255, 22/255, 28/255)
                let bg_color = NSColor::colorWithRed_green_blue_alpha(0.086, 0.086, 0.110, 1.0);
                ns_win.setBackgroundColor(Some(&bg_color));
            }

            #[cfg(not(target_os = "macos"))]
            let _ = window;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let event_id = event.id().as_ref();
            
            // Emit custom menu events to the frontend
            match event_id {
                "settings" | "new-session" | "toggle-sidebar" | "toggle-chat" | "check-updates" => {
                    let _ = app.emit("menu-event", event_id);
                }
                "help-docs" => {
                    let _ = tauri_plugin_opener::open_url("https://github.com/noelrohi/dilag#readme", None::<&str>);
                }
                "help-github" => {
                    let _ = tauri_plugin_opener::open_url("https://github.com/noelrohi/dilag", None::<&str>);
                }
                "help-issues" => {
                    let _ = tauri_plugin_opener::open_url("https://github.com/noelrohi/dilag/issues", None::<&str>);
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            check_opencode_installation,
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
            get_app_info,
            reset_all_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
