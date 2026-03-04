import { ApiError } from "../lib/api";

export type BootstrapState =
  | "INIT"
  | "CHECK_TOKENS"
  | "FETCH_ME"
  | "FETCH_TENANTS"
  | "CHECK_TENANT"
  | "READY"
  | "NO_TOKENS"
  | "TOKEN_EXPIRED"
  | "NO_TENANT_SELECTED"
  | "BACKEND_DOWN";

export type BootstrapSnapshot = {
  state: BootstrapState;
  detail: string;
  attempt: number;
};

export type BootstrapFlowDeps = {
  hasTokens: () => boolean;
  loadMe: () => Promise<void>;
  refresh: () => Promise<void>;
  loadTenants: () => Promise<unknown>;
  hasSelectedTenant: () => boolean;
  verifySelectedTenant: () => Promise<void>;
};

export const BOOTSTRAP_RETRY_DELAY_MS = 3000;

function toMessage(state: BootstrapState): string {
  if (state === "CHECK_TOKENS") return "Checking local session tokens";
  if (state === "FETCH_ME") return "Loading user profile";
  if (state === "FETCH_TENANTS") return "Loading tenant memberships";
  if (state === "CHECK_TENANT") return "Validating tenant selection";
  if (state === "NO_TOKENS") return "No token pair found";
  if (state === "TOKEN_EXPIRED") return "Token refresh failed";
  if (state === "NO_TENANT_SELECTED") return "No tenant selected";
  if (state === "BACKEND_DOWN") return "Backend unavailable; retrying";
  if (state === "READY") return "Session ready";
  return "Preparing startup";
}

function isBackendDown(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status >= 500;
  }
  return false;
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function publish(state: BootstrapState, onState: (snapshot: BootstrapSnapshot) => void, attempt: number, detail?: string): void {
  onState({
    state,
    detail: detail ?? toMessage(state),
    attempt,
  });
}

export async function runBootstrapFlow(
  deps: BootstrapFlowDeps,
  onState: (snapshot: BootstrapSnapshot) => void,
  attempt = 1,
): Promise<BootstrapState> {
  publish("INIT", onState, attempt);
  publish("CHECK_TOKENS", onState, attempt);
  if (!deps.hasTokens()) {
    publish("NO_TOKENS", onState, attempt);
    return "NO_TOKENS";
  }

  publish("FETCH_ME", onState, attempt);
  try {
    await deps.loadMe();
  } catch (error) {
    if (isUnauthorized(error)) {
      try {
        await deps.refresh();
      } catch {
        publish("TOKEN_EXPIRED", onState, attempt);
        return "TOKEN_EXPIRED";
      }
    } else if (isBackendDown(error)) {
      publish("BACKEND_DOWN", onState, attempt, error instanceof Error ? error.message : undefined);
      return "BACKEND_DOWN";
    } else {
      publish("TOKEN_EXPIRED", onState, attempt, error instanceof Error ? error.message : undefined);
      return "TOKEN_EXPIRED";
    }
  }

  publish("FETCH_TENANTS", onState, attempt);
  try {
    await deps.loadTenants();
  } catch (error) {
    if (isUnauthorized(error)) {
      publish("TOKEN_EXPIRED", onState, attempt);
      return "TOKEN_EXPIRED";
    }
    if (isBackendDown(error)) {
      publish("BACKEND_DOWN", onState, attempt, error instanceof Error ? error.message : undefined);
      return "BACKEND_DOWN";
    }
    // For client-side tenant failures (403/404/422), stop retry loop and route to tenant selection flow.
    publish("NO_TENANT_SELECTED", onState, attempt, error instanceof Error ? error.message : "Unable to load tenants");
    return "NO_TENANT_SELECTED";
  }

  publish("CHECK_TENANT", onState, attempt);
  if (!deps.hasSelectedTenant()) {
    publish("NO_TENANT_SELECTED", onState, attempt);
    return "NO_TENANT_SELECTED";
  }

  try {
    await deps.verifySelectedTenant();
  } catch (error) {
    if (isUnauthorized(error)) {
      publish("TOKEN_EXPIRED", onState, attempt);
      return "TOKEN_EXPIRED";
    }
    if (isBackendDown(error)) {
      publish("BACKEND_DOWN", onState, attempt, error instanceof Error ? error.message : undefined);
      return "BACKEND_DOWN";
    }
    publish("BACKEND_DOWN", onState, attempt, error instanceof Error ? error.message : undefined);
    return "BACKEND_DOWN";
  }

  publish("READY", onState, attempt);
  return "READY";
}
