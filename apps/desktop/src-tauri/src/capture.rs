//! HTML to image capture stub.
//!
//! Native WebKit capture was removed due to main thread dispatch complexity.
//! Frontend uses html2canvas for all capture operations.

/// Tauri command to capture HTML as PNG image
///
/// Always returns an error - frontend should use html2canvas.
#[tauri::command]
pub async fn capture_html_to_image(
    _html: String,
    _width: u32,
    _height: u32,
    _scale: f32,
) -> Result<Vec<u8>, String> {
    Err("Native capture not supported. Use html2canvas fallback.".into())
}
