export type PermissionCatalogItem = {
  id: string;
  label: string;
  description: string;
  groupKey: string;
  subgroupKey?: string;
  implies?: string[];
};

export type PermissionCatalogGroup = {
  groupKey: string;
  label: string;
  description: string;
  items: PermissionCatalogItem[];
};

function settingsItem(id: string, label: string, description: string, subgroupKey: string, implies?: string[]): PermissionCatalogItem {
  return { id, label, description, groupKey: "settings", subgroupKey, implies };
}

export const PERMISSION_CATALOG: PermissionCatalogGroup[] = [
  {
    groupKey: "settings",
    label: "Settings (Self)",
    description: "Controls what a user can view/edit in their own Settings pages. Does not grant access to Admin.",
    items: [
      settingsItem("settings.access", "Settings Access", "Can open /settings and view allowed sections.", "access"),
      settingsItem("settings.profile.read", "Profile Read", "View own profile settings.", "profile"),
      settingsItem("settings.profile.write", "Profile Write", "Edit own profile settings.", "profile", ["settings.profile.read"]),
      settingsItem("settings.preferences.read", "Preferences Read", "View own preferences.", "preferences"),
      settingsItem("settings.preferences.write", "Preferences Write", "Edit own preferences.", "preferences", ["settings.preferences.read"]),
      settingsItem("settings.workspace.read", "Workspace Read", "View own workspace settings.", "workspace"),
      settingsItem("settings.workspace.write", "Workspace Write", "Edit own workspace settings.", "workspace", ["settings.workspace.read"]),
      settingsItem("settings.notifications.read", "Notifications Read", "View own notification settings.", "notifications"),
      settingsItem("settings.notifications.write", "Notifications Write", "Edit own notification settings.", "notifications", ["settings.notifications.read"]),
      settingsItem("settings.sessions.read", "Sessions Read", "View own session information.", "sessions"),
      settingsItem("settings.sessions.signout_self", "Session Sign-out (Self)", "Sign out current session.", "sessions"),
    ],
  },
];

const ITEM_INDEX = new Map<string, PermissionCatalogItem>(
  PERMISSION_CATALOG.flatMap((group) => group.items.map((item) => [item.id, item] as const)),
);

export function normalizePermissionId(value: string): string {
  return value.trim().toLowerCase();
}

export function listPermissionsByGroup(groupKey: string): PermissionCatalogItem[] {
  const key = normalizePermissionId(groupKey);
  const match = PERMISSION_CATALOG.find((group) => normalizePermissionId(group.groupKey) === key);
  return match?.items ?? [];
}

export function getCatalogPermission(permissionId: string): PermissionCatalogItem | null {
  return ITEM_INDEX.get(normalizePermissionId(permissionId)) ?? null;
}

export function getImpliedPermissions(permissionId: string): string[] {
  const normalized = normalizePermissionId(permissionId);
  const fromCatalog = getCatalogPermission(normalized)?.implies ?? [];
  if (normalized.endsWith(".write")) {
    return Array.from(new Set([...fromCatalog, normalized.replace(/\.write$/, ".read")])).map(normalizePermissionId);
  }
  return fromCatalog.map(normalizePermissionId);
}

export function applyPermissionImplications(permissionIds: string[]): string[] {
  const out = new Set<string>();
  for (const item of permissionIds) {
    const normalized = normalizePermissionId(item);
    out.add(normalized);
    for (const implied of getImpliedPermissions(normalized)) {
      out.add(implied);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export function togglePermissionWithImplications(current: string[], permissionId: string, checked: boolean): string[] {
  const normalized = normalizePermissionId(permissionId);
  const set = new Set(current.map(normalizePermissionId));

  if (checked) {
    set.add(normalized);
    for (const implied of getImpliedPermissions(normalized)) {
      set.add(implied);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  set.delete(normalized);
  if (normalized.endsWith(".read")) {
    set.delete(normalized.replace(/\.read$/, ".write"));
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
