import { kutmApi } from "../../lib/kutm";
import { applyPermissionImplications, normalizePermissionId } from "./permissionCatalog";
import { getMockPermissionsForRole, mockRolePermissionsEnabled } from "./mockRolePermissions";

type PermissionResponse = { items?: Array<string | { key?: string | null }> } | null | undefined;

function normalizePermissionEntry(raw: unknown): string | null {
  if (typeof raw === "string") {
    const normalized = normalizePermissionId(raw);
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof raw === "object" && raw !== null && "key" in raw) {
    const key = (raw as { key?: unknown }).key;
    if (typeof key === "string") {
      const normalized = normalizePermissionId(key);
      return normalized.length > 0 ? normalized : null;
    }
  }
  return null;
}

export type RolePermissionResolution = {
  source: "backend" | "mock" | "none";
  permissions: string[];
};

export async function resolveRolePermissions(roleName: string | null | undefined): Promise<RolePermissionResolution> {
  const normalizedRole = (roleName ?? "").trim();
  const mockPermissions = mockRolePermissionsEnabled() ? getMockPermissionsForRole(normalizedRole) : null;
  if (mockPermissions && mockPermissions.length > 0) {
    return { source: "mock", permissions: applyPermissionImplications(mockPermissions) };
  }
  if (!normalizedRole) {
    return { source: "none", permissions: [] };
  }

  try {
    const payload = await kutmApi.get<PermissionResponse>("/rbac/permissions", { role: normalizedRole, page: 1, size: 500 });
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const permissions = items.map(normalizePermissionEntry).filter((item): item is string => Boolean(item));
    return {
      source: "backend",
      permissions: applyPermissionImplications(permissions),
    };
  } catch {
    return { source: "none", permissions: [] };
  }
}

export function resolveExplicitRolePermissions(permissions: string[], roleName?: string | null): RolePermissionResolution {
  const mockPermissions = mockRolePermissionsEnabled() ? getMockPermissionsForRole(roleName) : null;
  if (mockPermissions && mockPermissions.length > 0) {
    return { source: "mock", permissions: applyPermissionImplications(mockPermissions) };
  }
  return {
    source: "backend",
    permissions: applyPermissionImplications(permissions.map(normalizePermissionId)),
  };
}
