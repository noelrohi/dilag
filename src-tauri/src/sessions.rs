use crate::error::{AppError, AppResult};
use crate::paths::{get_sessions_dir, get_sessions_file};
use crate::state::{SessionMeta, SessionsStore};
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use tauri::Manager;

/// Load the sessions store from disk
fn load_sessions_store() -> SessionsStore {
    let file_path = get_sessions_file();
    if file_path.exists() {
        let content = fs::read_to_string(&file_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        SessionsStore::default()
    }
}

// =============================================================================
// Tauri Commands
// =============================================================================

#[tauri::command]
pub fn create_session_dir(session_id: String) -> AppResult<String> {
    let session_dir = get_sessions_dir().join(&session_id);
    fs::create_dir_all(&session_dir)?;
    Ok(session_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_session_cwd(session_id: String) -> String {
    get_sessions_dir()
        .join(&session_id)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub fn save_session_metadata(session: SessionMeta) -> AppResult<()> {
    let file_path = get_sessions_file();

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut store = load_sessions_store();

    if let Some(existing) = store.sessions.iter_mut().find(|s| s.id == session.id) {
        *existing = session;
    } else {
        store.sessions.push(session);
    }

    let json = serde_json::to_string_pretty(&store)?;
    fs::write(&file_path, json)?;

    Ok(())
}

#[tauri::command]
pub fn load_sessions_metadata() -> Vec<SessionMeta> {
    load_sessions_store().sessions
}

#[tauri::command]
pub fn delete_session_metadata(session_id: String) -> AppResult<()> {
    let file_path = get_sessions_file();
    let mut store = load_sessions_store();

    store.sessions.retain(|s| s.id != session_id);

    let json = serde_json::to_string_pretty(&store)?;
    fs::write(&file_path, json)?;

    let session_dir = get_sessions_dir().join(&session_id);
    if session_dir.exists() {
        fs::remove_dir_all(&session_dir)?;
    }

    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> AppResult<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn initialize_web_project(app: AppHandle, session_cwd: String) -> AppResult<()> {
    let resource_template = app
        .path()
        .resource_dir()
        .map_err(|e| AppError::Custom(e.to_string()))?
        .join("templates")
        .join("web-project");

    // In debug builds, prefer the dev template from source tree
    // In release builds, always use bundled resources
    #[cfg(debug_assertions)]
    let dev_template = Some(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("templates")
            .join("web-project"),
    );
    #[cfg(not(debug_assertions))]
    let dev_template: Option<std::path::PathBuf> = None;

    println!("[initialize_web_project] Resource template: {:?} (exists: {})", resource_template, resource_template.exists());
    if let Some(ref dev) = dev_template {
        println!("[initialize_web_project] Dev template: {:?} (exists: {})", dev, dev.exists());
    }

    let template_dir = if let Some(ref dev) = dev_template {
        if dev.exists() {
            println!("[initialize_web_project] Using dev template");
            dev.clone()
        } else if resource_template.exists() {
            println!("[initialize_web_project] Using resource template");
            resource_template
        } else {
            return Err(AppError::Custom(format!(
                "Web project template not found at {:?} or {:?}",
                resource_template, dev
            )));
        }
    } else if resource_template.exists() {
        println!("[initialize_web_project] Using resource template");
        resource_template
    } else {
        return Err(AppError::Custom(format!(
            "Web project template not found at {:?}",
            resource_template
        )));
    };

    println!("[initialize_web_project] Copying from {:?} to {:?}", template_dir, session_cwd);
    
    let dest_dir = Path::new(&session_cwd);
    copy_dir_recursive(&template_dir, dest_dir)?;

    println!("[initialize_web_project] Copy complete");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_copy_dir_recursive_preserves_structure() {
        // Create a temporary source directory with nested structure
        let src_dir = TempDir::new().unwrap();
        let src_path = src_dir.path();

        // Create nested directory structure similar to web-project template
        fs::create_dir_all(src_path.join("src/components")).unwrap();
        fs::create_dir_all(src_path.join("src/routes")).unwrap();

        // Create files at various levels
        File::create(src_path.join("index.html"))
            .unwrap()
            .write_all(b"<html></html>")
            .unwrap();
        File::create(src_path.join("package.json"))
            .unwrap()
            .write_all(b"{}")
            .unwrap();
        File::create(src_path.join("src/main.tsx"))
            .unwrap()
            .write_all(b"export default function() {}")
            .unwrap();
        File::create(src_path.join("src/index.css"))
            .unwrap()
            .write_all(b"body {}")
            .unwrap();
        File::create(src_path.join("src/components/error-boundary.tsx"))
            .unwrap()
            .write_all(b"export function ErrorBoundary() {}")
            .unwrap();
        File::create(src_path.join("src/routes/index.tsx"))
            .unwrap()
            .write_all(b"export function Index() {}")
            .unwrap();
        File::create(src_path.join("src/routes/__root.tsx"))
            .unwrap()
            .write_all(b"export function Root() {}")
            .unwrap();

        // Create destination directory
        let dst_dir = TempDir::new().unwrap();
        let dst_path = dst_dir.path();

        // Copy the directory
        copy_dir_recursive(src_path, dst_path).unwrap();

        // Verify directory structure is preserved
        assert!(dst_path.join("index.html").exists());
        assert!(dst_path.join("package.json").exists());
        assert!(dst_path.join("src").is_dir());
        assert!(dst_path.join("src/main.tsx").exists());
        assert!(dst_path.join("src/index.css").exists());
        assert!(dst_path.join("src/components").is_dir());
        assert!(dst_path.join("src/components/error-boundary.tsx").exists());
        assert!(dst_path.join("src/routes").is_dir());
        assert!(dst_path.join("src/routes/index.tsx").exists());
        assert!(dst_path.join("src/routes/__root.tsx").exists());

        // Verify file contents
        assert_eq!(
            fs::read_to_string(dst_path.join("index.html")).unwrap(),
            "<html></html>"
        );
        assert_eq!(
            fs::read_to_string(dst_path.join("src/components/error-boundary.tsx")).unwrap(),
            "export function ErrorBoundary() {}"
        );
    }

    #[test]
    fn test_copy_dir_recursive_creates_destination() {
        let src_dir = TempDir::new().unwrap();
        let src_path = src_dir.path();

        File::create(src_path.join("test.txt"))
            .unwrap()
            .write_all(b"hello")
            .unwrap();

        let dst_dir = TempDir::new().unwrap();
        let dst_path = dst_dir.path().join("new_subdir");

        // Destination doesn't exist yet
        assert!(!dst_path.exists());

        copy_dir_recursive(src_path, &dst_path).unwrap();

        // Destination was created and file was copied
        assert!(dst_path.exists());
        assert!(dst_path.join("test.txt").exists());
        assert_eq!(
            fs::read_to_string(dst_path.join("test.txt")).unwrap(),
            "hello"
        );
    }

    #[test]
    fn test_copy_dir_recursive_empty_directory() {
        let src_dir = TempDir::new().unwrap();
        let dst_dir = TempDir::new().unwrap();

        // Empty source directory
        fs::create_dir_all(src_dir.path().join("empty_subdir")).unwrap();

        copy_dir_recursive(src_dir.path(), dst_dir.path()).unwrap();

        // Empty subdirectory should be copied
        assert!(dst_dir.path().join("empty_subdir").is_dir());
    }
}
