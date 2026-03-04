export type SettingsSection =
  | "profile"
  | "preferences"
  | "workspace"
  | "notifications"
  | "sessions"
  | "shortcuts"
  | "access";

export const SETTINGS_CAPABILITIES: Record<string, string[]> = {
  Profile: [
    "Update your own profile display name.",
    "Update your own avatar URL placeholder.",
  ],
  Preferences: [
    "Update your own UI preferences: theme, density, timezone display, and default landing.",
  ],
  Workspace: [
    "Update your own workspace favorites and pinned apps.",
    "Update your own recent history preference.",
  ],
  Notifications: [
    "Update your own notification preferences (local placeholder until backend support exists).",
  ],
  Sessions: [
    "View your own active session/device information.",
    "Sign out your own current session.",
  ],
  Shortcuts: [
    "View keyboard shortcuts reference.",
  ],
};

export const SETTINGS_RBAC = {
  module: {
    access: ["settings.access"],
  },
  profile: {
    read: ["settings.profile.read"],
    write: ["settings.profile.write"],
  },
  preferences: {
    read: ["settings.preferences.read"],
    write: ["settings.preferences.write"],
  },
  workspace: {
    read: ["settings.workspace.read"],
    write: ["settings.workspace.write"],
  },
  notifications: {
    read: ["settings.notifications.read"],
    write: ["settings.notifications.write"],
  },
  sessions: {
    read: ["settings.sessions.read"],
    signoutSelf: ["settings.sessions.signout_self"],
  },
  shortcuts: {
    read: ["settings.access"],
  },
  access: {
    read: ["settings.access"],
  },
} as const;

export const SETTINGS_NON_GOALS: Array<{ action: string; redirectTo?: string; note: string }> = [
  {
    action: "Create, edit, or delete other users",
    redirectTo: "/admin/users",
    note: "User management is tenant-wide governance and belongs in Admin.",
  },
  {
    action: "Assign roles or permissions (self or others)",
    redirectTo: "/admin/roles",
    note: "Role and permission governance belongs in Admin.",
  },
  {
    action: "Change tenant configuration, feature flags, or modules",
    redirectTo: "/admin/settings",
    note: "Tenant-wide defaults and controls belong in Admin.",
  },
  {
    action: "View tenant-wide audit logs",
    redirectTo: "/admin/audit",
    note: "Audit governance belongs in Admin.",
  },
  {
    action: "Impersonate users",
    redirectTo: "/admin/users",
    note: "Impersonation is an Admin-only security workflow.",
  },
  {
    action: "Export tenant data",
    note: "Not available in Settings.",
  },
  {
    action: "Change system health or operations settings",
    redirectTo: "/admin/ops",
    note: "Operations controls belong in Admin.",
  },
];

export const SETTINGS_PERMISSION_DEFAULTS = [
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
] as const;

export type SettingsPermission = (typeof SETTINGS_PERMISSION_DEFAULTS)[number] | "settings.sessions.revoke_others";
