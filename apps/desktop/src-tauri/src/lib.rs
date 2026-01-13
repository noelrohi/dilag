#![recursion_limit = "256"]

mod app_info;
mod capture;
mod designs;
mod error;
mod licensing;
mod menu;
mod opencode;
mod paths;
mod sessions;
mod state;
mod theme;
mod zoom;

use tauri::webview::WebviewWindowBuilder;
use tauri::{Emitter, Manager, TitleBarStyle};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state::AppState::new())
        .setup(|app| {
            let menu = menu::setup_menu(app.handle())?;
            app.set_menu(menu)?;

            let port = opencode::get_free_port();
            {
                let app_state = app.state::<state::AppState>();
                *app_state.opencode_port.lock().unwrap() = Some(port);
            }
            println!("[setup] OpenCode port: {}", port);

            let win_builder =
                WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                    .title("Dilag")
                    .inner_size(1000.0, 700.0)
                    .min_inner_size(600.0, 400.0)
                    .maximized(true)
                    .title_bar_style(TitleBarStyle::Transparent)
                    .hidden_title(true)
                    .initialization_script(&format!(
                        r#"window.__DILAG__ = {{ port: {} }};"#,
                        port
                    ));

            let window = win_builder.build()?;

            // Set background color on macOS
            #[cfg(target_os = "macos")]
            {
                use objc2::rc::Retained;
                use objc2_app_kit::{NSColor, NSWindow};

                let ns_win: Retained<NSWindow> = unsafe {
                    let ptr = window.as_ref().window().ns_window().unwrap();
                    Retained::retain(ptr as *mut NSWindow).unwrap()
                };
                let bg_color = NSColor::colorWithRed_green_blue_alpha(0.086, 0.086, 0.110, 1.0);
                ns_win.setBackgroundColor(Some(&bg_color));
            }

            #[cfg(not(target_os = "macos"))]
            let _ = window;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let event_id = event.id().as_ref();

            match event_id {
                "settings" | "new-session" | "toggle-sidebar" | "toggle-chat" | "check-updates" => {
                    let _ = app.emit("menu-event", event_id);
                }
                "zoom-in" => {
                    if let Ok(level) = zoom::zoom_in(app.clone()) {
                        let _ = app.emit("zoom-changed", level);
                    }
                }
                "zoom-out" => {
                    if let Ok(level) = zoom::zoom_out(app.clone()) {
                        let _ = app.emit("zoom-changed", level);
                    }
                }
                "zoom-reset" => {
                    if let Ok(level) = zoom::zoom_reset(app.clone()) {
                        let _ = app.emit("zoom-changed", level);
                    }
                }
                "help-docs" => {
                    let _ = tauri_plugin_opener::open_url(
                        "https://github.com/noelrohi/dilag#readme",
                        None::<&str>,
                    );
                }
                "help-github" => {
                    let _ = tauri_plugin_opener::open_url(
                        "https://github.com/noelrohi/dilag",
                        None::<&str>,
                    );
                }
                "help-issues" => {
                    let _ = tauri_plugin_opener::open_url(
                        "https://github.com/noelrohi/dilag/issues",
                        None::<&str>,
                    );
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            // OpenCode commands
            opencode::check_opencode_installation,
            opencode::check_bun_installation,
            opencode::get_opencode_port,
            opencode::start_opencode_server,
            opencode::stop_opencode_server,
            opencode::restart_opencode_server,
            opencode::is_opencode_running,
            // Session commands
            sessions::create_session_dir,
            sessions::get_session_cwd,
            sessions::save_session_metadata,
            sessions::load_sessions_metadata,
            sessions::delete_session_metadata,
            sessions::toggle_session_favorite,
            // Design commands
            designs::load_session_designs,
            designs::copy_session_designs,
            designs::delete_design,
            // Capture commands
            capture::capture_html_to_image,
            // App info commands
            app_info::get_app_info,
            app_info::reset_all_data,
            // Theme commands
            theme::set_titlebar_theme,
            // Licensing commands
            licensing::get_license_status,
            licensing::start_trial,
            licensing::activate_license,
            licensing::validate_license,
            licensing::get_purchase_url,
            licensing::reset_license,
            // Zoom commands
            zoom::set_zoom_level,
            zoom::get_zoom_level,
            zoom::zoom_in,
            zoom::zoom_out,
            zoom::zoom_reset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
