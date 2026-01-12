use crate::error::AppResult;
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

    // Sort by modified time (oldest first)
    designs.sort_by(|a, b| a.modified_at.cmp(&b.modified_at));
    designs
}

/// Delete a design file from disk
#[tauri::command]
pub fn delete_design(file_path: String) -> AppResult<()> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path).into());
    }
    fs::remove_file(&path).map_err(|e| format!("Failed to delete {}: {}", file_path, e))?;
    Ok(())
}

/// Copy all design files from one session to another
#[tauri::command]
pub fn copy_session_designs(source_cwd: String, dest_cwd: String) -> AppResult<u32> {
    let source_screens = PathBuf::from(&source_cwd).join("screens");
    let dest_screens = PathBuf::from(&dest_cwd).join("screens");

    // Create destination screens directory
    fs::create_dir_all(&dest_screens).map_err(|e| format!("Failed to create screens dir: {}", e))?;

    let mut copied = 0u32;

    if source_screens.exists() {
        if let Ok(entries) = fs::read_dir(&source_screens) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().is_some_and(|e| e == "html") {
                    if let Some(filename) = path.file_name() {
                        let dest_path = dest_screens.join(filename);
                        fs::copy(&path, &dest_path)
                            .map_err(|e| format!("Failed to copy {}: {}", path.display(), e))?;
                        copied += 1;
                    }
                }
            }
        }
    }

    Ok(copied)
}
