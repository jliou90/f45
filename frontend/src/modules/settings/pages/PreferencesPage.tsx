import { useState } from "react";
import { Button, Select } from "../../../ui";
import { SETTINGS_RBAC } from "../capabilities";
import { SectionGate } from "../components/SectionGate";
import type { DefaultLanding, DensityMode } from "../data/settings.storage";
import { useSettingsState } from "../layout/settings-context";

function timezoneOptions(): string[] {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Array.from(new Set(["browser", browserTz, "UTC", "America/Chicago", "America/New_York", "America/Los_Angeles"]));
}

export function PreferencesPage() {
  const { settings, savePartial } = useSettingsState();
  const [draft, setDraft] = useState(settings.preferences);

  const onSave = () => {
    savePartial({
      preferences: draft,
    });
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Settings / Preferences</div>
        <h1>Preferences</h1>
        <p className="muted">Manage personal UI defaults for your account on this device.</p>
      </div>

      <SectionGate readPerm={SETTINGS_RBAC.preferences.read[0]} writePerm={SETTINGS_RBAC.preferences.write[0]} title="Preferences">
        {({ readOnly }) => (
          <div className="panel stack">
            <label>
              Theme
              <Select
                value={draft.theme}
                onChange={(event) => setDraft((prev) => ({ ...prev, theme: event.target.value as "light" | "dark" | "system" }))}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </label>

            <label>
              Density
              <Select
                value={draft.density}
                onChange={(event) => setDraft((prev) => ({ ...prev, density: event.target.value as DensityMode }))}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </Select>
            </label>

            <label>
              Timezone display
              <Select
                value={draft.timezone}
                onChange={(event) => setDraft((prev) => ({ ...prev, timezone: event.target.value }))}
              >
                {timezoneOptions().map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            </label>

            <label>
              Default landing page
              <Select
                value={draft.defaultLanding}
                onChange={(event) => setDraft((prev) => ({ ...prev, defaultLanding: event.target.value as DefaultLanding }))}
              >
                <option value="launcher">Launcher</option>
                <option value="last_app">Last visited app</option>
              </Select>
            </label>
            <div className="row">
              <Button type="button" onClick={onSave} disabled={readOnly} title={readOnly ? "Missing settings.preferences.write" : undefined}>
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </SectionGate>
    </div>
  );
}
