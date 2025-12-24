use std::path::PathBuf;

/// Root directory for all Dilag data (~/.dilag)
pub fn get_dilag_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".dilag")
}

/// Directory containing all session folders
pub fn get_sessions_dir() -> PathBuf {
    get_dilag_dir().join("sessions")
}

/// JSON file storing session metadata
pub fn get_sessions_file() -> PathBuf {
    get_dilag_dir().join("sessions.json")
}

/// OpenCode config directory (we set XDG_CONFIG_HOME to ~/.dilag)
pub fn get_opencode_config_dir() -> PathBuf {
    get_dilag_dir().join("opencode")
}
