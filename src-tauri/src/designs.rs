use crate::state::DesignFile;
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

/// Extract an HTML attribute value from content
fn extract_html_attr(html: &str, attr: &str) -> Option<String> {
    let pattern = format!(r#"{}=["']([^"']+)["']"#, attr);
    regex::Regex::new(&pattern)
        .ok()?
        .captures(html)?
        .get(1)
        .map(|m| m.as_str().to_string())
}

#[tauri::command]
pub fn load_session_designs(session_cwd: String) -> Vec<DesignFile> {
    let session_dir = PathBuf::from(&session_cwd);
    let screens_dir = session_dir.join("screens");
    let mut designs = Vec::new();

    let mut process_dir = |dir: &PathBuf| {
        if !dir.exists() {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().is_some_and(|e| e == "html") {
                    if let Ok(html) = fs::read_to_string(&path) {
                        let filename = path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default();

                        // Skip duplicates
                        if designs.iter().any(|d: &DesignFile| d.filename == filename) {
                            continue;
                        }

                        let title = extract_html_attr(&html, "data-title").unwrap_or_else(|| {
                            filename
                                .replace(".html", "")
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

                        let screen_type = extract_html_attr(&html, "data-screen-type")
                            .unwrap_or_else(|| "web".to_string());

                        let modified_at = entry
                            .metadata()
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
