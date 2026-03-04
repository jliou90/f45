import { applyPermissionImplications, normalizePermissionId } from "./permissionCatalog";

export type RoleTemplateKey = "sales" | "service_advisor" | "parts" | "fi" | "accounting" | "manager" | "admin" | "viewer";

const SETTINGS_FULL_EDIT = [
  "settings.access",
  "settings.profile.read",
  "settings.profile.write",
  "settings.preferences.read",
  "settings.preferences.write",
  "settings.workspace.read",
  "settings.workspace.write",
  "settings.notifications.read",
  "settings.notifications.write",
  "settings.sessions.read",
  "settings.sessions.signout_self",
];

const SETTINGS_VIEWER = [
  "settings.access",
  "settings.profile.read",
  "settings.preferences.read",
  "settings.workspace.read",
  "settings.notifications.read",
  "settings.sessions.read",
  "settings.sessions.signout_self",
];

export const ROLE_TEMPLATES: Record<RoleTemplateKey, { key: RoleTemplateKey; label: string; settingsPermissions: string[] }> = {
  sales: { key: "sales", label: "Sales", settingsPermissions: SETTINGS_FULL_EDIT },
  service_advisor: { key: "service_advisor", label: "Service Advisor", settingsPermissions: SETTINGS_FULL_EDIT },
  parts: { key: "parts", label: "Parts", settingsPermissions: SETTINGS_FULL_EDIT },
  fi: { key: "fi", label: "F&I", settingsPermissions: SETTINGS_FULL_EDIT },
  accounting: { key: "accounting", label: "Accounting", settingsPermissions: SETTINGS_FULL_EDIT },
  manager: { key: "manager", label: "Manager", settingsPermissions: SETTINGS_FULL_EDIT },
  admin: { key: "admin", label: "Admin", settingsPermissions: SETTINGS_FULL_EDIT },
  viewer: { key: "viewer", label: "Viewer", settingsPermissions: SETTINGS_VIEWER },
};

export function applyRoleTemplate(templateKey: RoleTemplateKey, existingPermissions: string[]): string[] {
  const template = ROLE_TEMPLATES[templateKey];
  const nonSettings = existingPermissions
    .map(normalizePermissionId)
    .filter((permission) => !permission.startsWith("settings."));
  return applyPermissionImplications([...nonSettings, ...template.settingsPermissions]);
}

export function settingsPermissionsForTemplate(templateKey: RoleTemplateKey): string[] {
  return applyPermissionImplications(ROLE_TEMPLATES[templateKey].settingsPermissions);
}
