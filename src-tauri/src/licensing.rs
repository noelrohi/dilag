use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ============================================================================
// Configuration
// ============================================================================
// Credentials are loaded from environment variables at compile time.
// Set these in your build environment or .cargo/config.toml:
//   POLAR_USE_SANDBOX=false
//   POLAR_ORG_ID=your-org-id
//   POLAR_PURCHASE_URL=https://buy.polar.sh/...
//
// For development/sandbox testing, the sandbox values are used as defaults.
// ============================================================================

/// Whether to use Polar sandbox
/// In release builds, defaults to production. In debug builds, defaults to sandbox.
/// Override by setting POLAR_USE_SANDBOX environment variable at compile time.
#[cfg(debug_assertions)]
const USE_SANDBOX: bool = true; // Debug mode: use sandbox by default

#[cfg(not(debug_assertions))]
const USE_SANDBOX: bool = false; // Release mode: use production by default

// Sandbox credentials (defaults for development)
const DEFAULT_SANDBOX_ORG_ID: &str = "7a87a3ca-b5b5-4291-aa65-cf8ed697d0f3";
const DEFAULT_SANDBOX_PURCHASE_URL: &str = "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_YS7VmovgnexWMpw74Wm4LG14Cp4BkkgmSH6Vh1wUAAa/redirect";

// Production credentials (from environment or defaults)
const DEFAULT_PROD_ORG_ID: &str = "bd461e2b-b924-41e7-97d0-3523bd99a3d0";
const DEFAULT_PROD_PURCHASE_URL: &str = "https://buy.polar.sh/polar_cl_6SB0k022Or8r5hVCfL4TSrsrWRibVOeuV0u9u2uIOmd";

const TRIAL_DAYS: i64 = 7;
const GRACE_PERIOD_SECS: u64 = 3 * 24 * 60 * 60; // 3 days
const EXTENDED_GRACE_SECS: u64 = 7 * 24 * 60 * 60; // 7 days for network issues

// API URLs based on environment
const SANDBOX_API: &str = "https://sandbox-api.polar.sh";
const PROD_API: &str = "https://api.polar.sh";

fn get_polar_org_id() -> &'static str {
    if USE_SANDBOX {
        option_env!("POLAR_SANDBOX_ORG_ID").unwrap_or(DEFAULT_SANDBOX_ORG_ID)
    } else {
        option_env!("POLAR_ORG_ID").unwrap_or(DEFAULT_PROD_ORG_ID)
    }
}

fn get_purchase_url_internal() -> &'static str {
    if USE_SANDBOX {
        option_env!("POLAR_SANDBOX_PURCHASE_URL").unwrap_or(DEFAULT_SANDBOX_PURCHASE_URL)
    } else {
        option_env!("POLAR_PURCHASE_URL").unwrap_or(DEFAULT_PROD_PURCHASE_URL)
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

/// Persisted license state stored in ~/.dilag/license.json
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct LicenseState {
    /// The license key entered by the user
    pub license_key: Option<String>,
    /// Polar activation ID (stored for potential deactivation/support purposes)
    pub activation_id: Option<String>,
    /// Machine UID (stored for support/debugging purposes)
    pub device_id: Option<String>,
    /// UTC timestamp when trial was started (from server time)
    pub trial_start_utc: Option<i64>,
    /// Last time we successfully validated the license with Polar
    pub last_validated_at: Option<u64>,
    /// When the license was activated
    pub activated_at: Option<u64>,
    /// Whether the license is currently activated
    pub is_activated: bool,
    /// Last server time check for trial validation (prevents clock manipulation)
    pub last_server_time_check: Option<i64>,
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

fn get_license_file() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())
        .map(|home| home.join(".dilag").join("license.json"))
}

fn load_license_state() -> Result<LicenseState, String> {
    let file_path = get_license_file()?;
    if file_path.exists() {
        let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(LicenseState::default())
    }
}

fn save_license_state(state: &LicenseState) -> Result<(), String> {
    let file_path = get_license_file()?;

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

    // Try worldtimeapi.org first (using HTTPS for security)
    if let Ok(response) = client
        .get("https://worldtimeapi.org/api/timezone/Etc/UTC")
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
    let state = match load_license_state() {
        Ok(s) => s,
        Err(e) => return LicenseStatus::Error { message: e },
    };
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
        // Try to get server time to prevent clock manipulation
        // If we can't reach any server, use stored last_server_time_check or local time as fallback
        let now = match get_server_time().await {
            Ok(server_time) => {
                // Update the last server time check
                let mut updated_state = state.clone();
                updated_state.last_server_time_check = Some(server_time);
                let _ = save_license_state(&updated_state); // Best effort, don't fail on this
                server_time
            }
            Err(_) => {
                // Fallback: use the most recent of local time or last server check
                // This prevents extending trial by setting clock back
                let local_time = Utc::now().timestamp();
                match state.last_server_time_check {
                    Some(last_check) if last_check > local_time => last_check,
                    _ => local_time,
                }
            }
        };

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

    let mut state = load_license_state()?;

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

    let mut state = load_license_state()?;
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
    let state = load_license_state()?;

    let key = state.license_key.ok_or("No license to validate")?;

    match validate_with_polar(&key).await {
        Ok(true) => {
            let mut state = load_license_state()?;
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
    get_purchase_url_internal().to_string()
}

#[tauri::command]
pub fn reset_license() -> Result<(), String> {
    let file_path = get_license_file()?;
    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_license_state_default() {
        let state = LicenseState::default();
        assert!(state.license_key.is_none());
        assert!(state.activation_id.is_none());
        assert!(state.device_id.is_none());
        assert!(state.trial_start_utc.is_none());
        assert!(state.last_validated_at.is_none());
        assert!(state.activated_at.is_none());
        assert!(!state.is_activated);
        assert!(state.last_server_time_check.is_none());
    }

    #[test]
    fn test_license_state_serialization() {
        let state = LicenseState {
            license_key: Some("test-key".to_string()),
            activation_id: Some("act-123".to_string()),
            device_id: Some("device-456".to_string()),
            trial_start_utc: Some(1700000000),
            last_validated_at: Some(1700000100),
            activated_at: Some(1700000050),
            is_activated: true,
            last_server_time_check: Some(1700000200),
        };

        let json = serde_json::to_string(&state).unwrap();
        let deserialized: LicenseState = serde_json::from_str(&json).unwrap();

        assert_eq!(state.license_key, deserialized.license_key);
        assert_eq!(state.activation_id, deserialized.activation_id);
        assert_eq!(state.device_id, deserialized.device_id);
        assert_eq!(state.trial_start_utc, deserialized.trial_start_utc);
        assert_eq!(state.last_validated_at, deserialized.last_validated_at);
        assert_eq!(state.activated_at, deserialized.activated_at);
        assert_eq!(state.is_activated, deserialized.is_activated);
        assert_eq!(state.last_server_time_check, deserialized.last_server_time_check);
    }

    #[test]
    fn test_license_status_serialization() {
        // Test NoLicense
        let no_license = LicenseStatus::NoLicense;
        let json = serde_json::to_string(&no_license).unwrap();
        assert!(json.contains("\"type\":\"NoLicense\""));

        // Test Trial
        let trial = LicenseStatus::Trial { days_remaining: 5 };
        let json = serde_json::to_string(&trial).unwrap();
        assert!(json.contains("\"type\":\"Trial\""));
        assert!(json.contains("\"days_remaining\":5"));

        // Test Activated
        let activated = LicenseStatus::Activated;
        let json = serde_json::to_string(&activated).unwrap();
        assert!(json.contains("\"type\":\"Activated\""));

        // Test TrialExpired
        let expired = LicenseStatus::TrialExpired;
        let json = serde_json::to_string(&expired).unwrap();
        assert!(json.contains("\"type\":\"TrialExpired\""));

        // Test RequiresValidation
        let requires = LicenseStatus::RequiresValidation;
        let json = serde_json::to_string(&requires).unwrap();
        assert!(json.contains("\"type\":\"RequiresValidation\""));

        // Test Error
        let error = LicenseStatus::Error {
            message: "Test error".to_string(),
        };
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("\"type\":\"Error\""));
        assert!(json.contains("\"message\":\"Test error\""));
    }

    #[test]
    fn test_trial_days_calculation() {
        // Helper to calculate days remaining
        fn calculate_days_remaining(trial_start: i64, now: i64) -> Option<u32> {
            let days_elapsed = (now - trial_start) / 86400;
            if days_elapsed >= TRIAL_DAYS {
                None // Expired
            } else {
                Some((TRIAL_DAYS - days_elapsed) as u32)
            }
        }

        // Day 0 - just started
        assert_eq!(calculate_days_remaining(1700000000, 1700000000), Some(7));

        // Day 1
        assert_eq!(calculate_days_remaining(1700000000, 1700000000 + 86400), Some(6));

        // Day 6 - last day
        assert_eq!(
            calculate_days_remaining(1700000000, 1700000000 + 6 * 86400),
            Some(1)
        );

        // Day 7 - expired
        assert_eq!(
            calculate_days_remaining(1700000000, 1700000000 + 7 * 86400),
            None
        );

        // Day 10 - well expired
        assert_eq!(
            calculate_days_remaining(1700000000, 1700000000 + 10 * 86400),
            None
        );
    }

    #[test]
    fn test_grace_period_constants() {
        // Ensure grace periods are configured correctly
        assert_eq!(GRACE_PERIOD_SECS, 3 * 24 * 60 * 60); // 3 days
        assert_eq!(EXTENDED_GRACE_SECS, 7 * 24 * 60 * 60); // 7 days
        assert!(EXTENDED_GRACE_SECS > GRACE_PERIOD_SECS);
    }

    #[test]
    fn test_grace_period_logic() {
        // Helper to check if within grace period
        fn check_grace_period(last_validated: u64, current_time: u64) -> &'static str {
            let time_since = current_time.saturating_sub(last_validated);
            if time_since < GRACE_PERIOD_SECS {
                "normal_grace"
            } else if time_since < EXTENDED_GRACE_SECS {
                "extended_grace"
            } else {
                "expired"
            }
        }

        let base_time: u64 = 1700000000;

        // Within normal grace (1 day)
        assert_eq!(
            check_grace_period(base_time, base_time + 86400),
            "normal_grace"
        );

        // Within normal grace (2 days)
        assert_eq!(
            check_grace_period(base_time, base_time + 2 * 86400),
            "normal_grace"
        );

        // Extended grace (4 days)
        assert_eq!(
            check_grace_period(base_time, base_time + 4 * 86400),
            "extended_grace"
        );

        // Extended grace (6 days)
        assert_eq!(
            check_grace_period(base_time, base_time + 6 * 86400),
            "extended_grace"
        );

        // Expired (8 days)
        assert_eq!(check_grace_period(base_time, base_time + 8 * 86400), "expired");
    }

    #[test]
    fn test_clock_manipulation_prevention() {
        // Test that we use the higher of local time or last server check
        fn get_effective_time(local_time: i64, last_server_check: Option<i64>) -> i64 {
            match last_server_check {
                Some(last_check) if last_check > local_time => last_check,
                _ => local_time,
            }
        }

        // No previous check - use local time
        assert_eq!(get_effective_time(1700000000, None), 1700000000);

        // Server check is older - use local time
        assert_eq!(
            get_effective_time(1700000000, Some(1699000000)),
            1700000000
        );

        // Server check is newer (clock set back) - use server time
        assert_eq!(
            get_effective_time(1699000000, Some(1700000000)),
            1700000000
        );
    }

    #[test]
    fn test_polar_api_urls() {
        // Just verify the URL format functions work
        let validation_url = get_validation_url();
        let activation_url = get_activation_url();

        assert!(validation_url.contains("/v1/customer-portal/license-keys/validate"));
        assert!(activation_url.contains("/v1/customer-portal/license-keys/activate"));

        if USE_SANDBOX {
            assert!(validation_url.starts_with("https://sandbox-api.polar.sh"));
            assert!(activation_url.starts_with("https://sandbox-api.polar.sh"));
        } else {
            assert!(validation_url.starts_with("https://api.polar.sh"));
            assert!(activation_url.starts_with("https://api.polar.sh"));
        }
    }

    #[test]
    fn test_get_polar_org_id() {
        let org_id = get_polar_org_id();
        assert!(!org_id.is_empty());
        // Should be a valid UUID format
        assert!(org_id.len() >= 32);
    }

    #[test]
    fn test_get_purchase_url() {
        let url = get_purchase_url_internal();
        assert!(!url.is_empty());
        assert!(url.starts_with("https://"));
    }
}
