//! HTML to image capture using platform-native WebView APIs.
//!
//! macOS: Uses WKWebView with takeSnapshot
//! Windows/Linux: Falls back to error (handled by frontend with html2canvas)

use crate::error::AppResult;

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use objc2::rc::Retained;
    use objc2::msg_send;
    use objc2_app_kit::NSApplication;
    use objc2_foundation::{MainThreadMarker, NSData, NSPoint, NSRect, NSSize, NSString, NSURL};
    use objc2_web_kit::{WKSnapshotConfiguration, WKWebView, WKWebViewConfiguration};
    use std::sync::mpsc;
    use std::time::Duration;

    /// Capture HTML content as PNG image data using WKWebView
    pub fn capture_html_to_png(
        html: &str,
        width: u32,
        height: u32,
        _scale: f32,
    ) -> AppResult<Vec<u8>> {
        // WKWebView must be created on the main thread
        let (tx, rx) = mpsc::channel::<Result<Vec<u8>, String>>();

        let html_owned = html.to_string();

        // Use dispatch to main queue
        std::thread::spawn(move || {
            let result = capture_sync(&html_owned, width, height);
            let _ = tx.send(result);
        });

        // Wait for result with timeout
        match rx.recv_timeout(Duration::from_secs(10)) {
            Ok(result) => result.map_err(|e| e.into()),
            Err(_) => Err("Capture timed out".into()),
        }
    }

    fn capture_sync(html: &str, width: u32, height: u32) -> Result<Vec<u8>, String> {
        unsafe {
            // Get main thread marker - required for UI operations
            let mtm = MainThreadMarker::new().ok_or("Must run on main thread")?;

            // Create frame for the webview
            let frame = NSRect::new(
                NSPoint::new(0.0, 0.0),
                NSSize::new(width as f64, height as f64),
            );

            // Create WKWebView configuration
            let config = WKWebViewConfiguration::new(mtm);

            // Create WKWebView
            let webview = WKWebView::initWithFrame_configuration(
                mtm.alloc::<WKWebView>(),
                frame,
                &config,
            );

            // Load HTML content
            let html_string = NSString::from_str(html);
            let base_url: Option<&NSURL> = None;
            webview.loadHTMLString_baseURL(&html_string, base_url);

            // Wait for load to complete (simple polling approach)
            let start = std::time::Instant::now();
            while webview.isLoading() && start.elapsed() < Duration::from_secs(5) {
                std::thread::sleep(Duration::from_millis(50));
                // Run the event loop briefly to allow loading to progress
                let app = NSApplication::sharedApplication(mtm);
                let _: () = msg_send![&app, updateWindows];
            }

            // Additional wait for rendering
            std::thread::sleep(Duration::from_millis(200));

            // Create snapshot configuration
            let snap_config = WKSnapshotConfiguration::new(mtm);
            // Set the rect using NSRect (setRect expects CGRect but NSRect is a type alias)
            let rect = NSRect::new(
                NSPoint::new(0.0, 0.0),
                NSSize::new(width as f64, height as f64),
            );
            snap_config.setRect(rect);

            // Take snapshot synchronously using a channel
            let (snap_tx, snap_rx) = mpsc::channel::<Result<Vec<u8>, String>>();

            let snap_tx_clone = snap_tx.clone();
            let block = block2::RcBlock::new(move |image: *mut objc2_app_kit::NSImage, error: *mut objc2_foundation::NSError| {
                if !error.is_null() {
                    let _ = snap_tx_clone.send(Err("Snapshot failed".to_string()));
                    return;
                }
                
                if image.is_null() {
                    let _ = snap_tx_clone.send(Err("No image returned".to_string()));
                    return;
                }

                // Convert NSImage to PNG data using TIFFRepresentation -> NSBitmapImageRep -> PNG
                let image_ref = &*image;
                
                // Get TIFF representation
                let tiff_data: Option<Retained<NSData>> = msg_send![image_ref, TIFFRepresentation];
                
                if let Some(tiff) = tiff_data {
                    // Create NSBitmapImageRep from TIFF data
                    let cls = objc2::class!(NSBitmapImageRep);
                    let rep: Option<Retained<objc2::runtime::AnyObject>> = 
                        msg_send![cls, imageRepWithData: &*tiff];
                    
                    if let Some(rep) = rep {
                        // Get PNG representation
                        // NSBitmapImageFileTypePNG = 4
                        let png_type: usize = 4;
                        let props: *const std::ffi::c_void = std::ptr::null();
                        let png_data: Option<Retained<NSData>> = 
                            msg_send![&rep, representationUsingType: png_type, properties: props];
                        
                        if let Some(png) = png_data {
                            // Get bytes from NSData
                            let bytes_ptr: *const u8 = msg_send![&png, bytes];
                            let len: usize = msg_send![&png, length];
                            
                            if !bytes_ptr.is_null() && len > 0 {
                                let vec = std::slice::from_raw_parts(bytes_ptr, len).to_vec();
                                let _ = snap_tx_clone.send(Ok(vec));
                                return;
                            }
                        }
                    }
                }
                
                let _ = snap_tx_clone.send(Err("Failed to convert to PNG".to_string()));
            });

            // Call takeSnapshotWithConfiguration:completionHandler:
            let _: () = msg_send![
                &webview,
                takeSnapshotWithConfiguration: &*snap_config,
                completionHandler: &*block
            ];

            // Run event loop to process the callback
            for _ in 0..100 {
                std::thread::sleep(Duration::from_millis(50));
                let app = NSApplication::sharedApplication(mtm);
                let _: () = msg_send![&app, updateWindows];
                
                // Check if we have a result
                if let Ok(result) = snap_rx.try_recv() {
                    return result;
                }
            }

            Err("Snapshot callback never fired".to_string())
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod fallback {
    use super::*;

    pub fn capture_html_to_png(
        _html: &str,
        _width: u32,
        _height: u32,
        _scale: f32,
    ) -> AppResult<Vec<u8>> {
        Err("Native capture not supported on this platform. Use html2canvas fallback.".into())
    }
}

/// Tauri command to capture HTML as PNG image
///
/// Returns PNG bytes on success, or an error string.
/// Frontend should fallback to html2canvas if this fails.
#[tauri::command]
pub async fn capture_html_to_image(
    html: String,
    width: u32,
    height: u32,
    scale: f32,
) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        macos::capture_html_to_png(&html, width, height, scale).map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        fallback::capture_html_to_png(&html, width, height, scale).map_err(|e| e.to_string())
    }
}
