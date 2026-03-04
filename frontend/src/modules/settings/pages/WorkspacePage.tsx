import { useEffect, useMemo, useState } from "react";
import { useFeatureFlags } from "../../../app/use-feature-flags";
import { useTenant } from "../../../app/use-tenant";
import { canAccess } from "../../../lib/rbac";
import { getLauncherTiles, getNavModel } from "../../../plugins/registry";
import { Button } from "../../../ui";
import { SETTINGS_RBAC } from "../capabilities";
import { SectionGate } from "../components/SectionGate";
import { useSettingsState } from "../layout/SettingsLayout";

export function WorkspacePage() {
  const tenant = useTenant();
  const featureFlags = useFeatureFlags();
  const { settings, savePartial } = useSettingsState();
  const [pinnedApps, setPinnedApps] = useState<string[]>(settings.workspace.pinnedApps);
  const [recentHistoryEnabled, setRecentHistoryEnabled] = useState(settings.workspace.recentHistoryEnabled);

  useEffect(() => {
    setPinnedApps(settings.workspace.pinnedApps);
    setRecentHistoryEnabled(settings.workspace.recentHistoryEnabled);
  }, [settings.workspace.pinnedApps, settings.workspace.recentHistoryEnabled]);

  const apps = useMemo(() => {
    const isDev = import.meta.env.DEV;
    const navByPath = new Map(
      getNavModel({ featureFlags: featureFlags.flags as Record<string, boolean | string | number>, isDev }).map((item) => [item.to, item]),
    );
    return getLauncherTiles({ featureFlags: featureFlags.flags as Record<string, boolean | string | number>, isDev })
      .filter((item) => {
        const nav = navByPath.get(item.to);
        if (!nav) return true;
        return canAccess(nav.routePolicy, tenant.currentRole, isDev);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tenant.currentRole, featureFlags.flags]);

  const pinned = new Set(pinnedApps);

  const togglePin = (appId: string) => {
    setPinnedApps((prev) => (prev.includes(appId) ? prev.filter((item) => item !== appId) : [...prev, appId]));
  };

  const onSave = () => {
    savePartial({
      workspace: {
        pinnedApps,
        recentHistoryEnabled,
      },
    });
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Settings / Workspace</div>
        <h1>Workspace</h1>
        <p className="muted">Choose self-scoped pinned apps and activity preferences.</p>
      </div>

      <SectionGate readPerm={SETTINGS_RBAC.workspace.read[0]} writePerm={SETTINGS_RBAC.workspace.write[0]} title="Workspace">
        {({ readOnly }) => (
          <>
            <div className="panel stack">
              <label className="row">
                <input
                  type="checkbox"
                  checked={recentHistoryEnabled}
                  onChange={(event) => setRecentHistoryEnabled(event.target.checked)}
                />
                Keep recent activity shortcuts in Launcher
              </label>
              <div className="row">
                <Button type="button" onClick={onSave} disabled={readOnly} title={readOnly ? "Missing settings.workspace.write" : undefined}>
                  Save Workspace
                </Button>
              </div>
            </div>

            <div className="panel">
              <div className="launcherGrid">
                {apps.map((app) => (
                  <article key={app.id} className="launcherTile">
                    <div className="launcherTileHeader">
                      <strong>{app.name}</strong>
                      <Button type="button" variant={pinned.has(app.id) ? "primary" : "secondary"} onClick={() => togglePin(app.id)}>
                        {pinned.has(app.id) ? "Pinned" : "Pin"}
                      </Button>
                    </div>
                    <p className="muted">{app.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </SectionGate>
    </div>
  );
}
