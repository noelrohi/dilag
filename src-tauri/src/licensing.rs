use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ============================================================================
// Configuration - Set these for your Polar.sh account
// ============================================================================

// Toggle this to switch between sandbox and production
const USE_SANDBOX: bool = false;

// Sandbox credentials (sandbox.polar.sh)
const SANDBOX_ORG_ID: &str = "7a87a3ca-b5b5-4291-aa65-cf8ed697d0f3";
const SANDBOX_PURCHASE_URL: &str = "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_YS7VmovgnexWMpw74Wm4LG14Cp4BkkgmSH6Vh1wUAAa/redirect";

// Production credentials (polar.sh)
const PROD_ORG_ID: &str = "bd461e2b-b924-41e7-97d0-3523bd99a3d0"; // Your production organization ID
const PROD_PURCHASE_URL: &str =
    "https://buy.polar.sh/polar_cl_6SB0k022Or8r5hVCfL4TSrsrWRibVOeuV0u9u2uIOmd";

const TRIAL_DAYS: i64 = 7;
const GRACE_PERIOD_SECS: u64 = 3 * 24 * 60 * 60; // 3 days
const EXTENDED_GRACE_SECS: u64 = 7 * 24 * 60 * 60; // 7 days for network issues

// API URLs based on environment
const SANDBOX_API: &str = "https://sandbox-api.polar.sh";
const PROD_API: &str = "https://api.polar.sh";

fn get_polar_org_id() -> &'static str {
    if USE_SANDBOX {
        SANDBOX_ORG_ID
    } else {
        PROD_ORG_ID
    }
}

fn get_validation_url() -> String {
    let base = if USE_SANDBOX { SANDBOX_API } else { PROD_API };
    format!("{}/v1/customer-portal/license-keys/validate", base)
}

fn get_activation_url() -> String {
    let base = if USE_SANDBOX { SANDBOX_API } else { PROD_API };
    format!("{}/v1/customer-portal/license-keys/activate", base)
}

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct LicenseState {
    pub license_key: Option<String>,
    pub activation_id: Option<String>,
    pub device_id: Option<String>,
    pub trial_start_utc: Option<i64>,
    pub last_validated_at: Option<u64>,
    pub activated_at: Option<u64>,
    pub is_activated: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum LicenseStatus {
    NoLicense,
    Trial { days_remaining: u32 },
    Activated,
    TrialExpired,
    RequiresValidation,
    Error { message: String },
}

#[derive(Debug, Serialize)]
struct PolarValidationRequest {
    key: String,
    organization_id: String,
}

#[derive(Debug, Serialize)]
struct PolarActivationRequest {
    key: String,
    organization_id: String,
    label: String,
}

#[derive(Debug, Deserialize)]
struct PolarValidationResponse {
    status: String,
}

#[derive(Debug, Deserialize)]
struct LicenseKeyNested {
    status: String,
}

#[derive(Debug, Deserialize)]
struct PolarActivationResponse {
    id: String,
    license_key: LicenseKeyNested,
}

#[derive(Debug, Deserialize)]
struct WorldTimeResponse {
    unixtime: i64,
}

// ============================================================================
// Device ID
// ============================================================================

fn get_device_id() -> Result<String, String> {
    machine_uid::get().map_err(|e| format!("Failed to get device ID: {}", e))
}

// ============================================================================
// File Operations
// ============================================================================

fn get_license_file() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".dilag")
        .join("license.json")
}

fn load_license_state() -> LicenseState {
    let file_path = get_license_file();
    if file_path.exists() {
        let content = fs::read_to_string(&file_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        LicenseState::default()
    }
}

fn save_license_state(state: &LicenseState) -> Result<(), String> {
    let file_path = get_license_file();

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(&file_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Time Utilities
// ============================================================================

async fn get_server_time() -> Result<i64, String> {
    let client = reqwest::Client::new();

    // Try worldtimeapi.org first
    if let Ok(response) = client
        .get("http://worldtimeapi.org/api/timezone/Etc/UTC")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        if response.status().is_success() {
            if let Ok(time_data) = response.json::<WorldTimeResponse>().await {
                return Ok(time_data.unixtime);
            }
        }
    }

    // Fallback: Parse HTTP Date header from a reliable server
    let fallback_urls = [
        "https://cloudflare.com/cdn-cgi/trace",
        "https://www.google.com",
    ];

    for url in fallback_urls {
        if let Ok(response) = client
            .head(url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            if let Some(date_header) = response.headers().get("date") {
                if let Ok(date_str) = date_header.to_str() {
                    // Parse HTTP date format: "Sat, 21 Dec 2024 10:30:00 GMT"
                    if let Ok(parsed) = chrono::DateTime::parse_from_rfc2822(date_str) {
                        return Ok(parsed.timestamp());
                    }
                }
            }
        }
    }

    Err("Could not fetch server time. Please check your internet connection.".to_string())
}

fn get_current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

// ============================================================================
// Polar API
// ============================================================================

async fn activate_with_polar(license_key: &str) -> Result<String, String> {
    let org_id = get_polar_org_id();
    if org_id.is_empty() {
        return Err("Polar organization ID not configured".to_string());
    }

    let client = reqwest::Client::new();
    let device_id = get_device_id()?;

    let request_body = PolarActivationRequest {
        key: license_key.to_string(),
        organization_id: org_id.to_string(),
        label: device_id,
    };

    let response = client
        .post(get_activation_url())
        .json(&request_body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if response.status().is_client_error() {
        let status_code = response.status().as_u16();
        return match status_code {
            400 => Err("Invalid license key format. Please check your license key.".to_string()),
            401 => Err("License key authentication failed.".to_string()),
            403 => Err("License key is expired or has reached its device limit.".to_string()),
            404 => Err("License key not found.".to_string()),
            409 => Err("License key already activated on maximum devices.".to_string()),
            _ => Err(format!("Activation failed (error {})", status_code)),
        };
    }

    if !response.status().is_success() {
        return Err("License server temporarily unavailable. Please try again.".to_string());
    }

    let activation: PolarActivationResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if activation.license_key.status == "granted" {
        Ok(activation.id)
    } else {
        Err(format!(
            "Activation rejected: {}",
            activation.license_key.status
        ))
    }
}

async fn validate_with_polar(license_key: &str) -> Result<bool, String> {
    let org_id = get_polar_org_id();
    if org_id.is_empty() {
        return Err("Polar organization ID not configured".to_string());
    }

    let client = reqwest::Client::new();

    let request_body = PolarValidationRequest {
        key: license_key.to_string(),
        organization_id: org_id.to_string(),
    };

    let response = client
        .post(get_validation_url())
        .json(&request_body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if response.status().is_client_error() {
        let status_code = response.status().as_u16();
        return match status_code {
            400 => Err("Invalid license key format.".to_string()),
            401 | 403 => Err("License key is invalid or expired.".to_string()),
            404 => Err("License key not found.".to_string()),
            _ => Err(format!("Validation failed (error {})", status_code)),
        };
    }

    if !response.status().is_success() {
        return Err("License server temporarily unavailable.".to_string());
    }

    let validation: PolarValidationResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(validation.status == "granted")
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn get_license_status() -> LicenseStatus {
    let state = load_license_state();
    let current_time = get_current_timestamp();

    // Check if activated
    if state.is_activated && state.license_key.is_some() {
        if let Some(last_validated) = state.last_validated_at {
            let time_since = current_time.saturating_sub(last_validated);

            // Within grace period - allow offline usage
            if time_since < GRACE_PERIOD_SECS {
                return LicenseStatus::Activated;
            }

            // Within extended grace - allow but should validate soon
            if time_since < EXTENDED_GRACE_SECS {
                return LicenseStatus::Activated;
            }

            // Beyond grace period - require validation
            return LicenseStatus::RequiresValidation;
        }
        return LicenseStatus::Activated;
    }

    // Check trial status
    if let Some(trial_start) = state.trial_start_utc {
        let now = Utc::now().timestamp();
        let days_elapsed = (now - trial_start) / 86400;

        if days_elapsed >= TRIAL_DAYS {
            return LicenseStatus::TrialExpired;
        }

        let days_remaining = (TRIAL_DAYS - days_elapsed) as u32;
        return LicenseStatus::Trial { days_remaining };
    }

    LicenseStatus::NoLicense
}

#[tauri::command]
pub async fn start_trial() -> Result<LicenseStatus, String> {
    let server_time = get_server_time().await?;

    let mut state = load_license_state();

    if state.trial_start_utc.is_some() {
        return Err("Trial already started".to_string());
    }

    state.trial_start_utc = Some(server_time);
    save_license_state(&state)?;

    Ok(LicenseStatus::Trial {
        days_remaining: TRIAL_DAYS as u32,
    })
}

#[tauri::command]
pub async fn activate_license(key: String) -> Result<LicenseStatus, String> {
    let activation_id = activate_with_polar(&key).await?;
    let device_id = get_device_id()?;
    let current_time = get_current_timestamp();

    let mut state = load_license_state();
    state.license_key = Some(key);
    state.activation_id = Some(activation_id);
    state.device_id = Some(device_id);
    state.is_activated = true;
    state.activated_at = Some(current_time);
    state.last_validated_at = Some(current_time);
    save_license_state(&state)?;

    Ok(LicenseStatus::Activated)
}

#[tauri::command]
pub async fn validate_license() -> Result<LicenseStatus, String> {
    let state = load_license_state();

    let key = state.license_key.ok_or("No license to validate")?;

    match validate_with_polar(&key).await {
        Ok(true) => {
            let mut state = load_license_state();
            state.last_validated_at = Some(get_current_timestamp());
            save_license_state(&state)?;
            Ok(LicenseStatus::Activated)
        }
        Ok(false) => Err("License is no longer valid".to_string()),
        Err(e) => {
            // Network error - check if within extended grace period
            if let Some(last_validated) = state.last_validated_at {
                let time_since = get_current_timestamp().saturating_sub(last_validated);
                if time_since < EXTENDED_GRACE_SECS {
                    return Ok(LicenseStatus::Activated);
                }
            }
            Err(e)
        }
    }
}

#[tauri::command]
pub fn get_purchase_url() -> String {
    if USE_SANDBOX {
        SANDBOX_PURCHASE_URL.to_string()
    } else {
        PROD_PURCHASE_URL.to_string()
    }
}

#[tauri::command]
pub fn reset_license() -> Result<(), String> {
    let file_path = get_license_file();
    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
