use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub struct AppState {
    pub opencode_pid: Mutex<Option<u32>>,
    pub opencode_port: Mutex<Option<u16>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            opencode_pid: Mutex::new(None),
            opencode_port: Mutex::new(None),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Session metadata stored locally
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionMeta {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub cwd: String,
    #[serde(default)]
    pub platform: Option<String>, // "web" (default) or "mobile"
    #[serde(default)]
    pub favorite: bool,
}

/// Design file extracted from a session directory
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DesignFile {
    pub filename: String,
    pub title: String,
    pub screen_type: String,
    pub html: String,
    pub modified_at: u64,
}

/// Local storage for sessions list
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SessionsStore {
    pub sessions: Vec<SessionMeta>,
}
