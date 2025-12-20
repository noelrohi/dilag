import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

// Types matching Rust LicenseStatus enum
export type LicenseStatus =
  | { type: "NoLicense" }
  | { type: "Trial"; days_remaining: number }
  | { type: "Activated" }
  | { type: "TrialExpired" }
  | { type: "RequiresValidation" }
  | { type: "Error"; message: string };

export interface LicenseState {
  status: LicenseStatus | null;
  loading: boolean;
  activating: boolean;
  error: string | null;
  purchaseUrl: string;
}

interface LicenseContextValue extends LicenseState {
  checkLicenseStatus: () => Promise<void>;
  startTrial: () => Promise<void>;
  activateLicense: (key: string) => Promise<void>;
  validateLicense: () => Promise<void>;
  resetLicense: () => Promise<void>;
  isTrialActive: boolean;
  isActivated: boolean;
  needsActivation: boolean;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

interface LicenseProviderProps {
  children: ReactNode;
}

export function LicenseProvider({ children }: LicenseProviderProps) {
  const [state, setState] = useState<LicenseState>({
    status: null,
    loading: true,
    activating: false,
    error: null,
    purchaseUrl: "",
  });

  const hasCheckedRef = useRef(false);

  const checkLicenseStatus = useCallback(async () => {
    try {
      const status = await invoke<LicenseStatus>("get_license_status");
      setState((prev) => ({ ...prev, status, loading: false, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        status: { type: "Error", message },
        loading: false,
        error: message,
      }));
    }
  }, []);

  const startTrial = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const status = await invoke<LicenseStatus>("start_trial");
      setState((prev) => ({ ...prev, status, loading: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  }, []);

  const activateLicense = useCallback(async (key: string) => {
    setState((prev) => ({ ...prev, activating: true, error: null }));
    try {
      const status = await invoke<LicenseStatus>("activate_license", { key });
      setState((prev) => ({ ...prev, status, activating: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, activating: false, error: message }));
      throw error;
    }
  }, []);

  const validateLicense = useCallback(async () => {
    try {
      const status = await invoke<LicenseStatus>("validate_license");
      setState((prev) => ({ ...prev, status, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  const resetLicense = useCallback(async () => {
    try {
      await invoke("reset_license");
      setState((prev) => ({ ...prev, status: { type: "NoLicense" }, error: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  // Check license status on mount
  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const init = async () => {
      try {
        const [status, purchaseUrl] = await Promise.all([
          invoke<LicenseStatus>("get_license_status"),
          invoke<string>("get_purchase_url"),
        ]);
        setState((prev) => ({ ...prev, status, purchaseUrl, loading: false }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          status: { type: "Error", message },
          loading: false,
          error: message,
        }));
      }
    };

    init();
  }, []);

  // Validate license periodically for activated users (every 24 hours)
  useEffect(() => {
    if (state.status?.type !== "Activated") return;

    const interval = setInterval(() => {
      validateLicense();
    }, 24 * 60 * 60 * 1000); // 24 hours

    return () => clearInterval(interval);
  }, [state.status?.type, validateLicense]);

  const isTrialActive = state.status?.type === "Trial";
  const isActivated = state.status?.type === "Activated";
  const needsActivation =
    state.status?.type === "TrialExpired" ||
    state.status?.type === "RequiresValidation";

  const value: LicenseContextValue = {
    ...state,
    checkLicenseStatus,
    startTrial,
    activateLicense,
    validateLicense,
    resetLicense,
    isTrialActive,
    isActivated,
    needsActivation,
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicenseContext() {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error("useLicenseContext must be used within a LicenseProvider");
  }
  return context;
}
