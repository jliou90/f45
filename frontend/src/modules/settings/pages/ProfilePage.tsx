import { useEffect, useState } from "react";
import { useAuth } from "../../../app/use-auth";
import { Button, Input } from "../../../ui";
import { SETTINGS_RBAC } from "../capabilities";
import { SectionGate } from "../components/SectionGate";
import { useSettingsState } from "../layout/SettingsLayout";

export function ProfilePage() {
  const auth = useAuth();
  const { settings, savePartial } = useSettingsState();
  const [displayName, setDisplayName] = useState(settings.profile.displayName);
  const [avatarUrl, setAvatarUrl] = useState(settings.profile.avatarUrl);

  useEffect(() => {
    setDisplayName(settings.profile.displayName);
    setAvatarUrl(settings.profile.avatarUrl);
  }, [settings.profile.avatarUrl, settings.profile.displayName]);

  const onSave = () => {
    savePartial({
      profile: {
        displayName,
        avatarUrl,
      },
    });
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Settings / Profile</div>
        <h1>Profile</h1>
        <p className="muted">Manage your self-scoped profile information for this workspace.</p>
      </div>

      <SectionGate readPerm={SETTINGS_RBAC.profile.read[0]} writePerm={SETTINGS_RBAC.profile.write[0]} title="Profile">
        {({ readOnly }) => (
          <div className="panel stack">
            <label>
              Email
              <Input value={auth.user?.email ?? ""} readOnly />
            </label>
            <label>
              Display name
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How your name appears in the app"
              />
            </label>
            <label>
              Avatar URL (placeholder)
              <Input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://example.com/avatar.png"
              />
            </label>
            <div className="row">
              <Button type="button" onClick={onSave} disabled={readOnly} title={readOnly ? "Missing settings.profile.write" : undefined}>
                Save Profile
              </Button>
            </div>
          </div>
        )}
      </SectionGate>
    </div>
  );
}
