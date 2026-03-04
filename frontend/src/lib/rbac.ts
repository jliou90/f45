export type UserRole = "ADMIN" | "OPS" | "MANAGER" | "USER" | "UNKNOWN";

export type RoutePolicy =
  | "OPS"
  | "ADMIN_OPS"
  | "OPS_OUTBOX"
  | "TENANTS"
  | "DMS"
  | "SALES"
  | "FI"
  | "SERVICE"
  | "PARTS"
  | "ACCOUNTING"
  | "COMMS"
  | "INVENTORY"
  | "REPORTS"
  | "ADMIN"
  | "DEV_CONTRACTS";

const ACCESS_MATRIX: Record<RoutePolicy, UserRole[]> = {
  OPS: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  ADMIN_OPS: ["ADMIN"],
  OPS_OUTBOX: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  TENANTS: ["ADMIN", "MANAGER"],
  DMS: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  SALES: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  FI: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  SERVICE: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  PARTS: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  ACCOUNTING: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  COMMS: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  INVENTORY: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  REPORTS: ["ADMIN", "MANAGER", "USER", "UNKNOWN"],
  ADMIN: ["ADMIN"],
  DEV_CONTRACTS: ["ADMIN"],
};

export function normalizeRole(role: string | null | undefined): UserRole {
  const normalized = (role ?? "").trim().toUpperCase();
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "OPS") return "OPS";
  if (normalized === "MANAGER") return "MANAGER";
  if (normalized === "USER") return "USER";
  return "UNKNOWN";
}

export function canAccess(route: RoutePolicy, role: string | null | undefined, isDev = import.meta.env.DEV): boolean {
  const normalizedRole = normalizeRole(role);
  const rawRole = (role ?? "").trim().toLowerCase();
  if (route === "DEV_CONTRACTS" && !isDev) {
    return false;
  }
  if (route === "ADMIN" && rawRole.includes("admin")) {
    return true;
  }
  return ACCESS_MATRIX[route].includes(normalizedRole);
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: [
    "admin:access",
    "admin.users.read",
    "admin.users.write",
    "admin.users.impersonate",
    "admin.roles.read",
    "admin.roles.write",
    "admin.audit.read",
    "ops.console.read",
    "tenant.settings.write",
    "featureflags.write",
    "theme.write",
  ],
  OPS: ["ops.console.read"],
  MANAGER: [],
  USER: [],
  UNKNOWN: [],
};

export function hasPermission(permission: string, role: string | null | undefined): boolean {
  const normalizedRole = normalizeRole(role);
  return ROLE_PERMISSIONS[normalizedRole].includes(permission.trim().toLowerCase());
}
