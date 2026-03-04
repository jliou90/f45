import { NavLink, Outlet } from "react-router-dom";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../../app/use-auth";
import { applyUserAppearance, readSettings, SettingsPermissionError, type UserSettingsV1, writeSettings } from "../data/settings.storage";
import { SettingsSubnav } from "./SettingsSubnav";
import { getFavorites, setFavorites } from "../../../lib/prefs";
import { useSettingsAccess, type SettingsAccessModel } from "../rbac";
import { SettingsContext, useSettingsState, type SettingsContextValue } from "./settings-context";

function hydrateSettings(userKey?: string | null): UserSettingsV1 {
  const current = readSettings(userKey);
  if (current.workspace.pinnedApps.length > 0) {
    return current;
  }
  return {
    ...current,
    workspace: {
      ...current.workspace,
      pinnedApps: getFavorites(userKey),
    },
  };
}

function SettingsContextProvider({ children, access }: { children: ReactNode; access: SettingsAccessModel }) {
  const auth = useAuth();
  const userKey = auth.user?.email;
  return (
    <SettingsContextProviderInner key={userKey ?? "__anon"} userKey={userKey} access={access}>
      {children}
    </SettingsContextProviderInner>
  );
}

function SettingsContextProviderInner({
  children,
  access,
  userKey,
}: {
  children: ReactNode;
  access: SettingsAccessModel;
  userKey?: string | null;
}) {
  const [saveError, setSaveError] = useState<SettingsPermissionError | null>(null);
  const [settings, setSettings] = useState<UserSettingsV1>(() => hydrateSettings(userKey));

  const savePartial = useCallback((partial: Partial<UserSettingsV1>): UserSettingsV1 => {
    try {
      const next = writeSettings(partial, userKey, {
        canWriteSection: access.canWriteSection,
        getWritePermissionForSection: (section) => {
          if (section === "profile") return "settings.profile.write";
          if (section === "preferences") return "settings.preferences.write";
          if (section === "workspace") return "settings.workspace.write";
          if (section === "notifications") return "settings.notifications.write";
          return null;
        },
      });
      setSaveError(null);
      setFavorites(next.workspace.pinnedApps, userKey);
      applyUserAppearance(next, userKey);
      setSettings(next);
      return next;
    } catch (error) {
      if (error instanceof SettingsPermissionError) {
        setSaveError(error);
        return settings;
      }
      throw error;
    }
  }, [access.canWriteSection, settings, userKey]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      access,
      saveError,
      clearSaveError: () => setSaveError(null),
      savePartial,
    }),
    [access, saveError, settings, savePartial],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function AccessDeniedPanel() {
  return (
    <div className="panel stack">
      <h1>Access Denied</h1>
      <p className="muted">You are authenticated, but you do not have permission to open Settings.</p>
      <button type="button" disabled title="Request workflow will be connected in a later patch">
        Request access (coming soon)
      </button>
    </div>
  );
}

export function SettingsLayout() {
  const access = useSettingsAccess();

  if (access.isLoading) {
    return (
      <div className="panel">
        <h1>Settings</h1>
        <p className="muted">Loading access policy...</p>
      </div>
    );
  }

  if (!access.hasPermission("settings.access")) {
    return <AccessDeniedPanel />;
  }

  return (
    <SettingsContextProvider access={access}>
      <div className="moduleLayout">
        <aside className="panel moduleNav">
          <h2>Settings</h2>
          <p className="muted">Self-scoped profile, preferences, and workspace controls.</p>
          <SettingsSubnav />
          <NavLink to="/app" className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
            Back to Launcher
          </NavLink>
        </aside>
        <section>
          <SettingsSaveError />
          <Outlet />
        </section>
      </div>
    </SettingsContextProvider>
  );
}

function SettingsSaveError() {
  const { saveError, clearSaveError } = useSettingsState();
  if (!saveError) return null;
  return (
    <div className="panel error stack">
      <h3>Unable to save settings</h3>
      <p className="muted">{saveError.message}</p>
      <button type="button" onClick={clearSaveError}>Dismiss</button>
    </div>
  );
}
