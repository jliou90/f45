import { kutmApi } from "./kutm";
import { clearStoredTenantId, clearStoredTenantName, clearStoredTokens, getStoredRefreshToken, setStoredTokens } from "./storage";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
};

export type AuthMe = {
  id: string;
  email: string;
};

export type TenantMembership = {
  id: string;
  name: string;
  role: string;
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
};

export type TenantPageResult = {
  items: TenantMembership[]; 
  meta?: {
    page: number;
    size: number;
    total: number;
  };
};

export async function login(email: string, password: string): Promise<TokenPair> {
  const tokens = await kutmApi.post<TokenPair>("/auth/login", { email, password }, false);
  setStoredTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
  return tokens;
}

export async function refresh(): Promise<TokenPair> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token in session storage");
  }
  const tokens = await kutmApi.request<TokenPair>("POST", "/auth/refresh", {
    body: { refresh_token: refreshToken },
    withTenant: false,
    skipAuthRefresh: true,
  });
  setStoredTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
  return tokens;
}

export function logoutLocal(): void {
  clearStoredTokens();
  clearStoredTenantId();
  clearStoredTenantName();
}

export async function me(): Promise<AuthMe> {
  return kutmApi.get<AuthMe>("/auth/me", undefined, false);
}

export async function tenantsMine(): Promise<TenantPageResult> {
  return kutmApi.get<TenantPageResult>("/tenants/mine", { page: 1, size: 50 }, false);
}

export async function currentTenant(): Promise<TenantMembership> {
  return kutmApi.get<TenantMembership>("/tenants/current", undefined, true);
}

export async function opsHealth(): Promise<Record<string, boolean>> {
  return kutmApi.get<Record<string, boolean>>("/ops/health", undefined, false);
}

export async function opsVersion(): Promise<Record<string, string | null>> {
  return kutmApi.get<Record<string, string | null>>("/ops/version", undefined, false);
}

export async function opsStatus(): Promise<Record<string, unknown>> {
  return kutmApi.get<Record<string, unknown>>("/ops/status", undefined, true);
}

export async function opsLogsTail(limit = 50): Promise<Record<string, unknown>> {
  return kutmApi.get<Record<string, unknown>>("/ops/logs/tail", { limit }, true);
}

export async function opsFeatureFlags(): Promise<Record<string, unknown>> {
  return kutmApi.get<Record<string, unknown>>("/ops/feature-flags", undefined, true);
}
