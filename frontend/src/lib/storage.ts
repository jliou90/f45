import { isBrowserEnvironment, makeStorageKey } from "./environment";

export const STORAGE_KEYS = {
  accessToken: makeStorageKey("access_token"),
  refreshToken: makeStorageKey("refresh_token"),
  tenantId: makeStorageKey("tenant_id"),
  tenantName: makeStorageKey("last_selected_tenant_name"),
} as const;

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

function safeStorage(): Storage | null {
  return isBrowserEnvironment() ? window.localStorage : null;
}

function safeSessionStorage(): Storage | null {
  return isBrowserEnvironment() ? window.sessionStorage : null;
}

let accessTokenMemory: string | null = null;
let refreshTokenMemory: string | null = null;

function migrateLegacyLocalTokens(): void {
  const local = safeStorage();
  const session = safeSessionStorage();
  if (!local || !session) return;

  const legacyAccess = local.getItem(STORAGE_KEYS.accessToken);
  const legacyRefresh = local.getItem(STORAGE_KEYS.refreshToken);
  if (legacyAccess && legacyRefresh) {
    session.setItem(STORAGE_KEYS.accessToken, legacyAccess);
    session.setItem(STORAGE_KEYS.refreshToken, legacyRefresh);
    local.removeItem(STORAGE_KEYS.accessToken);
    local.removeItem(STORAGE_KEYS.refreshToken);
  }
}

export function getStoredAccessToken(): string | null {
  if (accessTokenMemory) return accessTokenMemory;
  migrateLegacyLocalTokens();
  accessTokenMemory = safeSessionStorage()?.getItem(STORAGE_KEYS.accessToken) ?? null;
  return accessTokenMemory;
}

export function getStoredRefreshToken(): string | null {
  if (refreshTokenMemory) return refreshTokenMemory;
  migrateLegacyLocalTokens();
  refreshTokenMemory = safeSessionStorage()?.getItem(STORAGE_KEYS.refreshToken) ?? null;
  return refreshTokenMemory;
}

export function setStoredTokens(tokens: StoredTokens): void {
  const session = safeSessionStorage();
  if (!session) return;
  accessTokenMemory = tokens.accessToken;
  refreshTokenMemory = tokens.refreshToken;
  session.setItem(STORAGE_KEYS.accessToken, tokens.accessToken);
  session.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken);
  safeStorage()?.removeItem(STORAGE_KEYS.accessToken);
  safeStorage()?.removeItem(STORAGE_KEYS.refreshToken);
}

export function clearStoredTokens(): void {
  accessTokenMemory = null;
  refreshTokenMemory = null;
  safeSessionStorage()?.removeItem(STORAGE_KEYS.accessToken);
  safeSessionStorage()?.removeItem(STORAGE_KEYS.refreshToken);
  safeStorage()?.removeItem(STORAGE_KEYS.accessToken);
  safeStorage()?.removeItem(STORAGE_KEYS.refreshToken);
}

export function getStoredTenantId(): string | null {
  return safeStorage()?.getItem(STORAGE_KEYS.tenantId) ?? null;
}

export function setStoredTenantId(tenantId: string): void {
  safeStorage()?.setItem(STORAGE_KEYS.tenantId, tenantId);
}

export function clearStoredTenantId(): void {
  safeStorage()?.removeItem(STORAGE_KEYS.tenantId);
}

export function getStoredTenantName(): string | null {
  return safeStorage()?.getItem(STORAGE_KEYS.tenantName) ?? null;
}

export function setStoredTenantName(name: string): void {
  safeStorage()?.setItem(STORAGE_KEYS.tenantName, name);
}

export function clearStoredTenantName(): void {
  safeStorage()?.removeItem(STORAGE_KEYS.tenantName);
}
