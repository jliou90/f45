import { useEffect, useState } from "react";
import { Button } from "../../../ui";
import { SETTINGS_RBAC } from "../capabilities";
import { SectionGate } from "../components/SectionGate";
import { useSettingsState } from "../layout/SettingsLayout";

export function NotificationsPage() {
  const { settings, savePartial } = useSettingsState();
  const [desktopEnabled, setDesktopEnabled] = useState(settings.notifications.desktopEnabled);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(settings.notifications.emailDigestEnabled);

  useEffect(() => {
    setDesktopEnabled(settings.notifications.desktopEnabled);
    setEmailDigestEnabled(settings.notifications.emailDigestEnabled);
  }, [settings.notifications.desktopEnabled, settings.notifications.emailDigestEnabled]);

  const onSave = () => {
    savePartial({
      notifications: {
        desktopEnabled,
        emailDigestEnabled,
      },
    });
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Settings / Notifications</div>
        <h1>Notifications</h1>
        <p className="muted">Self-scoped placeholder preferences until backend notification APIs are available.</p>
      </div>

      <SectionGate
        readPerm={SETTINGS_RBAC.notifications.read[0]}
        writePerm={SETTINGS_RBAC.notifications.write[0]}
        title="Notifications"
      >
        {({ readOnly }) => (
          <div className="panel stack">
            <label className="row">
              <input
                type="checkbox"
                checked={desktopEnabled}
                onChange={(event) => setDesktopEnabled(event.target.checked)}
              />
              Enable desktop alerts (local only)
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={emailDigestEnabled}
                onChange={(event) => setEmailDigestEnabled(event.target.checked)}
              />
              Enable email digest (placeholder)
            </label>
            <div className="row">
              <Button type="button" onClick={onSave} disabled={readOnly} title={readOnly ? "Missing settings.notifications.write" : undefined}>
                Save Notifications
              </Button>
            </div>
          </div>
        )}
      </SectionGate>
    </div>
  );
}
