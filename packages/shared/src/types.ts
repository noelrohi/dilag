/**
 * Trial registration request from desktop app
 */
export interface TrialRegisterRequest {
  device_id: string;
}

/**
 * Trial registration response
 */
export interface TrialRegisterResponse {
  allowed: boolean;
  trial_start_utc?: number;
  message?: string;
}

/**
 * Trial status check request
 */
export interface TrialCheckRequest {
  device_id: string;
}

/**
 * Trial status response
 */
export interface TrialCheckResponse {
  has_trial: boolean;
  trial_start_utc?: number;
  days_remaining?: number;
  expired?: boolean;
}
