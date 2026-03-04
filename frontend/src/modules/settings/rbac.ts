import { useMemo } from "react";
import { useAuth } from "../../app/use-auth";
import { useTenant } from "../../app/use-tenant";
import { resolveRolePermissions } from "../../core/rbac/rolePermissions";
import { hasPermission } from "../../lib/rbac";
import { useQuery } from "../../lib/query";
import { SETTINGS_PERMISSION_DEFAULTS, type SettingsPermission, type SettingsSection } from "./capabilities";

type PermissionSet = Set<string>;

function normalizePermission(permission: string): string {
  return permission.trim().toLowerCase();
}

function settingsSectionPermissionPrefix(section: SettingsSection): string {
  if (section === "access" || section === "shortcuts") {
    return "settings.access";
  }
  return `settings.${section}.`;
}

function buildEffectiveSettingsPermissions(remotePermissions: string[]): PermissionSet {
  const defaults = new Set<string>(SETTINGS_PERMISSION_DEFAULTS);
  const settingsPermissions = remotePermissions.filter((permission) => permission.startsWith("settings."));
  if (settingsPermissions.length === 0) {
    return defaults;
  }

  const merged = new Set<string>();
  for (const permission of settingsPermissions) {
    merged.add(permission);
  }
  return merged;
}

export type SettingsAccessModel = {
  isLoading: boolean;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  canReadSection: (section: SettingsSection) => boolean;
  canWriteSection: (section: SettingsSection) => boolean;
  canSignOutSelf: boolean;
  hasAdminInspectorAccess: boolean;
};

export function useSettingsAccess(): SettingsAccessModel {
  const auth = useAuth();
  const tenant = useTenant();
  const role = tenant.currentRole;
  const permissionsQuery = useQuery(
    () => resolveRolePermissions(role),
    { deps: [role], enabled: auth.isAuthenticated && Boolean(role), debugLabel: "settings_role_permissions" },
  );

  const permissionSet = useMemo(() => {
    if (!auth.isAuthenticated) {
      return new Set<string>();
    }
    const remote = permissionsQuery.data?.permissions ?? [];
    return buildEffectiveSettingsPermissions(remote.map(normalizePermission));
  }, [auth.isAuthenticated, permissionsQuery.data?.permissions]);

  const permissions = useMemo(() => [...permissionSet].sort((a, b) => a.localeCompare(b)), [permissionSet]);

  const model = useMemo<SettingsAccessModel>(() => {
    const hasPermissionFn = (permission: string) => permissionSet.has(normalizePermission(permission));
    const canReadSection = (section: SettingsSection) => {
      if (section === "shortcuts" || section === "access") {
        return hasPermissionFn("settings.access");
      }
      return hasPermissionFn(`settings.${section}.read`);
    };
    const canWriteSection = (section: SettingsSection) => {
      if (section === "sessions" || section === "shortcuts" || section === "access") {
        return false;
      }
      return hasPermissionFn(`settings.${section}.write`);
    };

    return {
      isLoading: auth.isAuthenticated && permissionsQuery.isLoading,
      permissions,
      hasPermission: hasPermissionFn,
      canReadSection,
      canWriteSection,
      canSignOutSelf: hasPermissionFn("settings.sessions.signout_self"),
      hasAdminInspectorAccess: hasPermission("admin:access", role),
    };
  }, [auth.isAuthenticated, permissionsQuery.isLoading, permissions, permissionSet, role]);

  return model;
}

export function isSettingsPermission(permission: string): permission is SettingsPermission {
  return normalizePermission(permission).startsWith("settings.");
}

export function getRequiredPermissionForSectionRead(section: SettingsSection): string {
  if (section === "shortcuts" || section === "access") return "settings.access";
  return `${settingsSectionPermissionPrefix(section)}read`;
}

export function getRequiredPermissionForSectionWrite(section: SettingsSection): string | null {
  if (section === "sessions" || section === "shortcuts" || section === "access") return null;
  return `${settingsSectionPermissionPrefix(section)}write`;
}
