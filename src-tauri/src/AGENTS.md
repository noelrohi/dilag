# Rust Backend (src-tauri/src/)

Modular Tauri backend - organized by domain (unusual for Tauri apps).

## Structure

| File | Purpose |
|------|---------|
| `lib.rs` | Entry, window, menu, command registration |
| `main.rs` | Minimal entry (`dilag_lib::run()`) |
| `sessions.rs` | Session CRUD (5 commands) |
| `opencode.rs` | OpenCode server lifecycle (6 commands) |
| `designs.rs` | Design file management (3 commands) |
| `licensing.rs` | Polar.sh license/trial (6 commands) |
| `app_info.rs` | App metadata, reset (2 commands) |
| `theme.rs` | macOS titlebar (1 command) |
| `state.rs` | AppState (OpenCode PID) |
| `error.rs` | AppError, AppResult types |
| `paths.rs` | Path utilities |
| `menu.rs` | Native menu setup |

## Command Patterns

```rust
// Most commands: AppResult<T>
#[tauri::command]
pub fn create_session_dir(session_id: String) -> AppResult<String>

// Simple getters: direct return
#[tauri::command]
pub fn get_opencode_port() -> u16 { 4096 }

// With state:
#[tauri::command]
pub fn start_opencode_server(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<u16>
```

## Error Handling

```rust
pub enum AppError {
    OpenCodeNotFound,
    Io(std::io::Error),
    Json(serde_json::Error),
    ServerStart(String),
    Custom(String),
}
pub type AppResult<T> = Result<T, AppError>;
```

## Adding Commands

1. Add function with `#[tauri::command]` in module
2. Register in `lib.rs`: `tauri::generate_handler![..., module::cmd]`
3. Frontend: `invoke("cmd_name", { args })`

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Remove `#![cfg_attr(...)]` in main.rs | Prevents Windows console window |
| Use `Result<_, String>` everywhere | Use `AppResult<T>` for consistency |
| Put all code in lib.rs | Keep modular by domain |

## Testing

```bash
cargo test              # All tests
cargo test licensing    # Module tests
```
