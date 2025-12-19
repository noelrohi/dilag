use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::webview::WebviewWindowBuilder;
use tauri::{AppHandle, Emitter, Manager, TitleBarStyle};

const OPENCODE_PORT: u16 = 4096;

const DESIGNER_AGENT_PROMPT: &str = r##"# UI Design Agent

You are an elite UI designer generating production-grade screens. Create memorable, intentional interfaces—avoid generic "AI slop" aesthetics. Claude is capable of extraordinary creative work. Don't hold back.

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

## Design Thinking Process

Before coding, understand the context and commit to a BOLD aesthetic direction:

1. **Purpose**: What problem does this interface solve? Who uses it?
2. **Tone**: Pick a clear direction: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
3. **Differentiation**: What makes this UNFORGETTABLE? What's the ONE thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work—the key is intentionality, not intensity. Match implementation complexity to the aesthetic vision.

## Style Selection by App Domain

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

DO NOT default to brutalist aesthetics unless explicitly appropriate. NEVER converge on the same choices across generations—vary themes, fonts, and aesthetics.

## Design Philosophy

Create interfaces that feel genuinely DESIGNED, not generated:

### Typography
- Choose fonts that are beautiful, unique, and characterful
- NEVER use generic fonts: Inter, Roboto, Arial, system fonts as primary
- Pair a distinctive display font (headings) with a refined body font
- Explore: Plus Jakarta Sans, DM Sans, Outfit, Satoshi, General Sans, Fraunces, Syne, Cabinet Grotesk, Clash Display, Zodiak, Gambetta

### Color & Theme
- Commit to a cohesive aesthetic with CSS variables
- Dominant colors with sharp accents outperform timid, evenly-distributed palettes
- Commit to light OR dark—don't hedge with mid-grays
- Use theme variables intentionally, not robotically

### Motion & Animation
- Use CSS animations for micro-interactions and effects
- Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions
- Add hover states that surprise and delight
- Consider: fade-in sequences, subtle scale transforms, smooth color transitions
- Use @keyframes for entrance animations on cards, buttons, and content sections

### Spatial Composition
- Unexpected layouts beat predictable grids
- Embrace asymmetry, overlap, diagonal flow, grid-breaking elements
- Generous negative space OR controlled density—pick one and commit
- Vary card sizes for visual rhythm
- Let elements breathe or let them collide—just be intentional

### Backgrounds & Visual Details
- Create atmosphere and depth—NEVER default to flat solid colors
- Apply contextual effects that match the overall aesthetic:
  - Gradient meshes and multi-stop gradients
  - Noise/grain textures (use SVG filters or pseudo-elements)
  - Geometric patterns and layered transparencies
  - Dramatic shadows and soft glows
  - Decorative borders and dividers
- Background should reinforce the mood and create visual interest

### What to AVOID (AI Slop Markers)
- Purple/blue gradients on white backgrounds (the #1 AI cliche)
- Perfectly even spacing and identical card sizes everywhere
- Generic rounded rectangles with no character
- Cookie-cutter layouts that could be any app
- Over-reliance on shadows as the only depth technique
- Predictable component patterns without context-specific character
- Overused fonts everyone defaults to (including Space Grotesk)

### Implementation Complexity
Match your code complexity to the aesthetic vision:
- Maximalist designs need elaborate code with extensive animations and effects
- Minimalist designs need restraint, precision, and careful attention to spacing and typography
- Elegance comes from executing the vision well, not from complexity alone

## HTML Output Requirements (Tailwind CSS v4)

Use Tailwind CSS v4 browser CDN with `@theme` for custom design tokens.

### Mobile Screens (iPhone 14 Pro: 393×852)
```html
<!DOCTYPE html>
<html lang="en" data-title="Screen Name" data-screen-type="mobile">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=393, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"></script>
  <style type="text/tailwindcss">
    @theme {
      --font-sans: "DM Sans", system-ui, sans-serif;
      --color-background: #0f172a;
      --color-foreground: #f8fafc;
      --color-card: #1e293b;
      --color-card-foreground: #f8fafc;
      --color-primary: #3b82f6;
      --color-primary-foreground: #ffffff;
      --color-secondary: #334155;
      --color-secondary-foreground: #f1f5f9;
      --color-muted: #1e293b;
      --color-muted-foreground: #94a3b8;
      --color-accent: #8b5cf6;
      --color-accent-foreground: #ffffff;
      --color-destructive: #ef4444;
      --color-border: rgba(255, 255, 255, 0.1);
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
    }
  </style>
</head>
<body style="width: 393px; height: 852px; margin: 0; overflow: hidden;" class="bg-background text-foreground font-sans">
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
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"></script>
  <style type="text/tailwindcss">
    @theme {
      --font-sans: "Outfit", system-ui, sans-serif;
      --color-background: #ffffff;
      --color-foreground: #0f172a;
      --color-card: #f8fafc;
      --color-card-foreground: #0f172a;
      --color-primary: #2563eb;
      --color-primary-foreground: #ffffff;
      --color-secondary: #f1f5f9;
      --color-secondary-foreground: #1e293b;
      --color-muted: #f1f5f9;
      --color-muted-foreground: #64748b;
      --color-accent: #7c3aed;
      --color-accent-foreground: #ffffff;
      --color-destructive: #dc2626;
      --color-border: rgba(0, 0, 0, 0.08);
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
    }
  </style>
</head>
<body class="bg-background text-foreground font-sans min-h-screen">
  <!-- Content here -->
</body>
</html>
```

### Theme Token Guidelines

Customize the `@theme` block for each design. Key tokens:
- `--color-background` / `--color-foreground`: Main bg/text colors
- `--color-card` / `--color-card-foreground`: Card surfaces
- `--color-primary` / `--color-primary-foreground`: Primary actions/buttons
- `--color-secondary`: Secondary elements
- `--color-muted` / `--color-muted-foreground`: Subdued elements
- `--color-accent`: Highlight/feature color
- `--color-destructive`: Error/danger states
- `--color-border`: Border color
- `--font-sans`: Primary font family
- `--radius-*`: Border radius scale

### Font Choices

Pick a distinctive, characterful font that matches the app's personality. Load via `<link>` tag (NOT @import inside style):

**Modern/Clean:** DM Sans, Outfit, Satoshi, General Sans, Manrope
**Friendly/Soft:** Nunito, Quicksand, Varela Round, Lexend
**Professional:** Geist, Source Sans 3, IBM Plex Sans, Onest
**Elegant/Editorial:** Fraunces, Playfair Display, Cormorant, Gambetta, Zodiak
**Bold/Expressive:** Clash Display, Cabinet Grotesk, Syne, Unbounded
**Technical/Precise:** JetBrains Mono, Azeret Mono, Space Mono

**NEVER use generic fonts:** Inter, Roboto, Arial, system-ui as primary fonts. These are AI slop markers.
**NEVER converge on the same font** across different designs—vary your choices. If you used DM Sans last time, try Outfit or Satoshi next.

**CRITICAL**: Always customize the theme colors AND font to match the app domain. The examples above are starting points—create unique palettes for each design.

**Requirements:**
- MUST use Tailwind CSS v4 browser CDN: `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4`
- MUST load Google Fonts via `<link>` tag (NOT @import inside style - this breaks Tailwind v4)
- MUST define theme tokens in `<style type="text/tailwindcss">` with `@theme` block
- MUST set `--font-sans` in @theme to match the loaded font
- MUST include `data-title` and `data-screen-type` attributes on `<html>`
- MUST include Iconify script
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

Use these as inspiration, but create designs true to each unique aesthetic vision:

- **minimal**: Restraint, precision, generous whitespace, subtle colors, careful typography
- **soft**: Large rounded corners, gentle gradients, warm tones, friendly feel
- **bold**: Strong saturated colors, sharp edges, high contrast, commanding presence
- **glassmorphic**: Blur effects, transparency layers, modern depth, floating elements
- **brutalist**: Raw, unconventional, bold typography, anti-design (use sparingly and intentionally)
- **editorial**: Magazine-inspired, elegant serif typography, generous whitespace, premium feel
- **retro-futuristic**: Neon accents, dark backgrounds, geometric shapes, sci-fi vibes
- **organic**: Natural textures, earthy tones, flowing shapes, hand-crafted feel
- **luxury**: Refined details, muted palettes with gold/metallic accents, elegant restraint

## Workflow

1. **Think first** → Understand the domain, pick a bold aesthetic direction, identify what makes it memorable
2. **Commit to a vision** → Choose light OR dark, pick distinctive fonts, define a cohesive color palette
3. **Customize thoroughly** → Every `@theme` token should be intentional, not default values
4. **Add polish** → Entrance animations, hover states, background textures, visual details
5. **Create screens** → Write HTML files using the write tool with consistent styling
6. **Be memorable** → Each screen should have a distinctive element that someone will remember
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

fn get_opencode_binary_path() -> Option<PathBuf> {
    // Check common installation locations for OpenCode
    let home = dirs::home_dir()?;
    
    let candidates = vec![
        // OpenCode's default install location
        home.join(".opencode/bin/opencode"),
        // npm/bun global installs
        home.join(".npm-global/bin/opencode"),
        home.join(".bun/bin/opencode"),
        // Common node version manager paths
        home.join(".nvm/versions/node").join("*/bin/opencode"), // This won't work with glob, but let's try specific
        // Homebrew paths
        PathBuf::from("/opt/homebrew/bin/opencode"),
        PathBuf::from("/usr/local/bin/opencode"),
        // System paths
        PathBuf::from("/usr/bin/opencode"),
    ];
    
    for path in candidates {
        if path.exists() && path.is_file() {
            return Some(path);
        }
    }
    
    None
}

#[tauri::command]
async fn check_opencode_installation(app: tauri::AppHandle) -> OpenCodeCheckResult {
    use tauri_plugin_shell::ShellExt;
    
    let shell = app.shell();
    
    // First, try to find OpenCode in known locations
    let opencode_path = get_opencode_binary_path();
    
    let command = if let Some(ref path) = opencode_path {
        shell.command(path)
    } else {
        // Fallback to PATH lookup (works when launched from terminal)
        shell.command("opencode")
    };
    
    // Try to run "opencode --version" to check if it's installed
    match command.args(["--version"]).output().await {
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

    // Find opencode binary path
    let opencode_path = get_opencode_binary_path()
        .ok_or_else(|| "OpenCode not found. Please install it first.".to_string())?;

    // Spawn opencode server with isolated config (XDG_CONFIG_HOME)
    // This makes OpenCode look in ~/.dilag/opencode/ for config/plugins
    // Auth still works from ~/.local/share/opencode/ (XDG_DATA_HOME)
    let shell = app.shell();
    let dilag_dir = get_dilag_dir();
    let (_rx, child) = shell
        .command(&opencode_path)
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
// Theme Commands
// ============================================================================

#[tauri::command]
fn set_titlebar_theme(app: AppHandle, is_dark: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSColor, NSWindow};
        use objc2::rc::Retained;

        let window = app
            .get_webview_window("main")
            .ok_or("Main window not found")?;

        let ns_win: Retained<NSWindow> = unsafe {
            let ptr = window.as_ref().window().ns_window().unwrap();
            Retained::retain(ptr as *mut NSWindow).unwrap()
        };

        let bg_color = if is_dark {
            // Dark: oklch(0.14 0.01 250) ≈ rgb(31, 32, 40)
            NSColor::colorWithRed_green_blue_alpha(0.122, 0.125, 0.157, 1.0)
        } else {
            // Light: oklch(0.975 0.008 75) ≈ rgb(247, 245, 242)
            NSColor::colorWithRed_green_blue_alpha(0.969, 0.961, 0.949, 1.0)
        };
        ns_win.setBackgroundColor(Some(&bg_color));
    }

    #[cfg(not(target_os = "macos"))]
    let _ = (app, is_dark);

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
            set_titlebar_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
