use crate::error::AppResult;
use tauri::AppHandle;

#[tauri::command]
pub fn set_titlebar_theme(app: AppHandle, is_dark: bool) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        use objc2::rc::Retained;
        use objc2_app_kit::{NSColor, NSWindow};
        use tauri::Manager;

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
