import { API_BASE_ORIGIN, kutmApi } from "../../lib/kutm";

export type AdminPermission = {
  key: string;
  description: string;
};

export type AdminRole = {
  id: string;
  name: string;
  description: string | null;
  permission_count: number;
  memberships_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminRoleDetail = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  permissions: string[];
  memberships_count: number;
  created_at: string;
  updated_at: string;
  request_id?: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  role_id: string | null;
  role_name: string | null;
  membership_id: string;
  updated_at: string;
};

export type AdminUserDetail = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  role_id: string | null;
  role_name: string | null;
  membership_id: string;
  membership_created_at: string;
  membership_updated_at: string;
  created_at: string;
  updated_at: string;
  request_id?: string | null;
};

export type AdminInvite = {
  id: string;
  email: string;
  display_name: string | null;
  role_id: string;
  role_name: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  status: "active" | "expired" | "revoked" | "accepted";
};

export type AdminSession = {
  session_id: string;
  created_at: string;
  last_seen_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  user_agent_hash: string | null;
  ip_hash: string | null;
  is_active: boolean;
};

export type AdminAuditEvent = {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  timestamp: string;
  diff: Record<string, unknown> | null;
  request_id: string | null;
  actor_ip?: string | null;
  user_agent?: string | null;
};

export type AdminFeatureFlagCatalogItem = {
  key: string;
  description: string;
  default_value: unknown;
};

export type AdminFeatureOverrideRecord = {
  flag_key: string;
  value: unknown;
  enabled: boolean;
  updated_at?: string;
  role_id?: string;
  user_id?: string;
};

export type TenantProfile = {
  tenant_id: string;
  display_name?: string | null;
  legal_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  theme: Record<string, unknown>;
  request_id?: string | null;
};

export type TenantTheme = {
  accent_color: string;
  logo_variant: string;
  sidebar_style: string;
  print_header_enabled: boolean;
  request_id?: string | null;
};

type Meta = {
  page: number;
  size: number;
  total: number;
};

export type Paged<T> = {
  items: T[];
  meta: Meta;
  request_id?: string | null;
};

export async function adminListPermissions(): Promise<{ items: AdminPermission[]; request_id?: string | null }> {
  return kutmApi.get("/admin/permissions");
}

export async function adminListRoles(params?: { page?: number; size?: number; query?: string }): Promise<Paged<AdminRole>> {
  return kutmApi.get("/admin/roles", params ?? { page: 1, size: 50 });
}

export async function adminCreateRole(payload: { name: string; description?: string | null; permissions: string[] }): Promise<AdminRoleDetail> {
  return kutmApi.post("/admin/roles", payload);
}

export async function adminGetRole(roleId: string): Promise<AdminRoleDetail> {
  return kutmApi.get(`/admin/roles/${roleId}`);
}

export async function adminUpdateRole(
  roleId: string,
  payload: { name: string; description?: string | null; permissions: string[] },
): Promise<AdminRoleDetail> {
  return kutmApi.put(`/admin/roles/${roleId}`, payload);
}

export async function adminDeleteRole(roleId: string, force = false): Promise<{ ok: boolean; id: string; request_id?: string | null }> {
  return kutmApi.delete(`/admin/roles/${roleId}?force=${force ? "true" : "false"}`);
}

export async function adminListUsers(params?: { page?: number; size?: number; query?: string }): Promise<Paged<AdminUser>> {
  return kutmApi.get("/admin/users", params ?? { page: 1, size: 50 });
}

export async function adminCreateUser(payload: { email: string; display_name?: string; role_id: string; password?: string }): Promise<AdminUserDetail> {
  return kutmApi.post("/admin/users", payload);
}

export async function adminUpdateUser(
  userId: string,
  payload: { email?: string; display_name?: string; is_active?: boolean },
): Promise<AdminUserDetail> {
  return kutmApi.put(`/admin/users/${userId}`, payload);
}

export async function adminChangeUserRole(userId: string, role_id: string): Promise<AdminUserDetail> {
  return kutmApi.put(`/admin/users/${userId}/role`, { role_id });
}

export async function adminDisableUser(userId: string): Promise<{ ok: boolean; id: string; request_id?: string | null }> {
  return kutmApi.delete(`/admin/users/${userId}`);
}

export async function adminBulkUsers(payload: {
  action: "disable" | "set_role";
  user_ids: string[];
  role_id?: string;
}): Promise<{ action: string; successes: string[]; failures: Array<{ user_id: string; code: string; message: string }>; request_id?: string | null }> {
  return kutmApi.post("/admin/users/bulk", payload);
}

export async function adminCreateInvite(payload: {
  email: string;
  display_name?: string;
  role_id: string;
  expires_in_days?: number;
}): Promise<{ invite_id: string; invite_link?: string | null; request_id?: string | null }> {
  return kutmApi.post("/admin/invites", payload);
}

export async function adminListInvites(params?: { page?: number; size?: number; query?: string }): Promise<Paged<AdminInvite>> {
  return kutmApi.get("/admin/invites", params ?? { page: 1, size: 50 });
}

export async function adminRevokeInvite(inviteId: string): Promise<{ ok: boolean; id: string; request_id?: string | null }> {
  return kutmApi.delete(`/admin/invites/${inviteId}`);
}

export async function adminCreatePasswordReset(userId: string): Promise<{ ok: boolean; link?: string | null; request_id?: string | null }> {
  return kutmApi.post(`/admin/users/${userId}/password-reset`);
}

export async function adminListUserSessions(userId: string, params?: { page?: number; size?: number }): Promise<Paged<AdminSession>> {
  return kutmApi.get(`/admin/users/${userId}/sessions`, params ?? { page: 1, size: 100 });
}

export async function adminRevokeAllSessions(userId: string): Promise<{ ok: boolean; revoked_count?: number; request_id?: string | null }> {
  return kutmApi.post(`/admin/users/${userId}/sessions/revoke`);
}

export async function adminRevokeSession(sessionId: string): Promise<{ ok: boolean; session_id?: string; request_id?: string | null }> {
  return kutmApi.post(`/admin/sessions/revoke?session_id=${encodeURIComponent(sessionId)}`);
}

export async function adminListAudit(params?: {
  page?: number;
  size?: number;
  actor?: string;
  action?: string;
  ts_from?: string;
  ts_to?: string;
}): Promise<Paged<AdminAuditEvent>> {
  return kutmApi.get("/admin/audit", params ?? { page: 1, size: 50 });
}

export async function adminExportAudit(params?: { fmt?: "json" | "csv"; ts_from?: string; ts_to?: string }): Promise<string | { items: AdminAuditEvent[]; request_id?: string | null }> {
  return kutmApi.get("/admin/audit/export", params ?? { fmt: "json" });
}

export async function adminFeatureFlagCatalog(): Promise<{ items: AdminFeatureFlagCatalogItem[]; request_id?: string | null }> {
  return kutmApi.get("/admin/feature-flags/catalog");
}

export async function adminFeatureFlagEffective(params?: { role_id?: string }): Promise<{ flags: Record<string, unknown>; request_id?: string | null }> {
  return kutmApi.get("/admin/feature-flags/effective", params ?? {});
}

export async function adminFeatureFlagOverrides(): Promise<{
  tenant: AdminFeatureOverrideRecord[];
  role: AdminFeatureOverrideRecord[];
  user: AdminFeatureOverrideRecord[];
  request_id?: string | null;
}> {
  return kutmApi.get("/admin/feature-flags/overrides");
}

export async function adminUpsertFeatureFlagOverride(flagKey: string, payload: { scope: "tenant" | "role" | "user"; role_id?: string; user_id?: string; value: unknown }): Promise<{ ok: boolean; request_id?: string | null }> {
  return kutmApi.put(`/admin/feature-flags/overrides/${encodeURIComponent(flagKey)}`, payload);
}

export async function adminDeleteFeatureFlagOverride(
  flagKey: string,
  payload: { scope: "tenant" | "role" | "user"; role_id?: string; user_id?: string },
): Promise<{ ok: boolean; deleted: number; request_id?: string | null }> {
  const query = new URLSearchParams();
  query.set("scope", payload.scope);
  if (payload.role_id) query.set("role_id", payload.role_id);
  if (payload.user_id) query.set("user_id", payload.user_id);
  return kutmApi.delete(`/admin/feature-flags/overrides/${encodeURIComponent(flagKey)}?${query.toString()}`);
}

export async function adminGetTenantProfile(): Promise<TenantProfile> {
  return kutmApi.get("/admin/tenant/profile");
}

export async function adminUpdateTenantProfile(payload: Partial<Omit<TenantProfile, "tenant_id" | "theme" | "request_id">>): Promise<TenantProfile> {
  return kutmApi.put("/admin/tenant/profile", payload);
}

export async function adminSetTenantLogoUrl(logo_url: string): Promise<TenantProfile> {
  return kutmApi.put("/admin/tenant/logo-url", { logo_url });
}

export async function adminGetTenantTheme(): Promise<TenantTheme> {
  return kutmApi.get("/admin/tenant/theme");
}

export async function adminUpdateTenantTheme(payload: Partial<Omit<TenantTheme, "request_id">>): Promise<TenantTheme> {
  return kutmApi.put("/admin/tenant/theme", payload);
}

let cachedImpersonationEndpoint: string | null | undefined;
let cachedImpersonationExitEndpoint: string | null | undefined;

function resolveFirstPath(paths: Record<string, unknown>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (paths[candidate]) {
      return candidate;
    }
  }
  return null;
}

export async function adminDetectImpersonationSupport(): Promise<{ enabled: boolean; endpoint: string | null }> {
  if (cachedImpersonationEndpoint !== undefined) {
    return { enabled: Boolean(cachedImpersonationEndpoint), endpoint: cachedImpersonationEndpoint ?? null };
  }
  try {
    const response = await fetch(`${API_BASE_ORIGIN}/openapi.json`);
    if (!response.ok) {
      cachedImpersonationEndpoint = null;
      cachedImpersonationExitEndpoint = null;
      return { enabled: false, endpoint: null };
    }
    const payload = await response.json() as { paths?: Record<string, unknown> };
    const paths = payload.paths ?? {};
    cachedImpersonationEndpoint = resolveFirstPath(paths, ["/api/v1/admin/impersonate", "/api/v1/auth/impersonate"]);
    cachedImpersonationExitEndpoint = resolveFirstPath(paths, ["/api/v1/admin/impersonate/exit", "/api/v1/auth/impersonate/exit"]);
    return { enabled: Boolean(cachedImpersonationEndpoint), endpoint: cachedImpersonationEndpoint ?? null };
  } catch {
    cachedImpersonationEndpoint = null;
    cachedImpersonationExitEndpoint = null;
    return { enabled: false, endpoint: null };
  }
}

export async function adminStartImpersonation(userId: string): Promise<{ ok: boolean; request_id?: string | null }> {
  const support = await adminDetectImpersonationSupport();
  if (!support.endpoint) {
    throw new Error("Backend support not enabled yet");
  }
  const endpoint = support.endpoint.replace("/api/v1", "");
  return kutmApi.post(endpoint, { user_id: userId });
}

export async function adminExitImpersonation(): Promise<{ ok: boolean; request_id?: string | null }> {
  const support = await adminDetectImpersonationSupport();
  const endpoint = cachedImpersonationExitEndpoint ?? support.endpoint;
  if (!endpoint) {
    throw new Error("Backend support not enabled yet");
  }
  return kutmApi.post(endpoint.replace("/api/v1", ""));
}
