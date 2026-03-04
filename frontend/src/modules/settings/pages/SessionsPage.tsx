import { useAuth } from "../../../app/use-auth";
import { getStoredAccessToken } from "../../../lib/storage";
import { useQuery } from "../../../lib/query";
import { Badge, Button } from "../../../ui";
import { SETTINGS_RBAC } from "../capabilities";
import { SectionGate } from "../components/SectionGate";
import { loadSessionDevices } from "../data/settings.api";
import { useSettingsState } from "../layout/SettingsLayout";

export function SessionsPage() {
  const auth = useAuth();
  const { access } = useSettingsState();
  const sessionsQuery = useQuery(() => loadSessionDevices(), { deps: [], debugLabel: "settings_sessions" });

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Settings / Sessions</div>
        <h1>Sessions & Devices</h1>
        <p className="muted">View your local current session and sign out self when permitted.</p>
      </div>

      <SectionGate readPerm={SETTINGS_RBAC.sessions.read[0]} title="Sessions">
        <div className="panel stack">
          <p><strong>Current user:</strong> {auth.user?.email ?? "n/a"}</p>
          <p><strong>Local token loaded:</strong> {getStoredAccessToken() ? "Yes" : "No"}</p>
          <p><strong>Current device:</strong> Browser session on this machine</p>
          <div className="row">
            <Badge tone={access.canSignOutSelf ? "ok" : "warn"}>
              {access.canSignOutSelf ? "Can sign out self" : "Cannot sign out self"}
            </Badge>
            <Button
              type="button"
              variant="secondary"
              onClick={() => auth.logout()}
              disabled={!access.canSignOutSelf}
              title={access.canSignOutSelf ? undefined : `Missing ${SETTINGS_RBAC.sessions.signoutSelf[0]}`}
            >
              Sign out this session
            </Button>
          </div>
        </div>
      </SectionGate>

      {sessionsQuery.data?.supported === false ? (
        <div className="panel">
          <p className="muted">Backend session device APIs are not available yet. Local session info is shown above.</p>
        </div>
      ) : null}
    </div>
  );
}
