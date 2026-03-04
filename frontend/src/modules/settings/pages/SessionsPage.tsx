import { useAuth } from "../../../app/use-auth";
import { useToast } from "../../../app/use-toast";
import { getStoredAccessToken } from "../../../lib/storage";
import { useQuery } from "../../../lib/query";
import { Badge, Button, Input } from "../../../ui";
import { SETTINGS_RBAC } from "../capabilities";
import { SectionGate } from "../components/SectionGate";
import { disableMfa, loadSessionDevices, startMfaEnrollment, verifyMfaEnrollment } from "../data/settings.api";
import { useSettingsState } from "../layout/settings-context";
import { useState } from "react";

export function SessionsPage() {
  const auth = useAuth();
  const toast = useToast();
  const { access } = useSettingsState();
  const sessionsQuery = useQuery(() => loadSessionDevices(), { deps: [], debugLabel: "settings_sessions" });
  const [secret, setSecret] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"start" | "verify" | "disable" | null>(null);

  const onStartMfa = async () => {
    setBusy("start");
    try {
      const started = await startMfaEnrollment();
      setSecret(started.secret);
      toast.pushToast("success", "MFA enrollment started.");
    } catch (error) {
      toast.pushToast("error", `MFA start failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const onVerifyMfa = async () => {
    if (!otp.trim()) return;
    setBusy("verify");
    try {
      await verifyMfaEnrollment(otp.trim());
      setSecret(null);
      setOtp("");
      toast.pushToast("success", "MFA enabled.");
    } catch (error) {
      toast.pushToast("error", `MFA verify failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const onDisableMfa = async () => {
    if (!otp.trim()) return;
    setBusy("disable");
    try {
      await disableMfa(otp.trim());
      setSecret(null);
      setOtp("");
      toast.pushToast("success", "MFA disabled.");
    } catch (error) {
      toast.pushToast("error", `MFA disable failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

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

      <SectionGate readPerm={SETTINGS_RBAC.sessions.read[0]} title="Security">
        <div className="panel stack">
          <h2>MFA Security</h2>
          <p className="muted">Use authenticator OTP to enforce second-factor login.</p>
          <div className="row">
            <Button type="button" onClick={() => void onStartMfa()} disabled={busy !== null}>
              {busy === "start" ? "Starting..." : "Start MFA Enrollment"}
            </Button>
          </div>
          {secret ? (
            <div className="stack">
              <p>
                <strong>Secret:</strong> <code>{secret}</code>
              </p>
              <p className="muted">Add this secret to your authenticator app, then enter current OTP.</p>
            </div>
          ) : null}
          <label>
            OTP Code
            <Input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" />
          </label>
          <div className="row">
            <Button type="button" onClick={() => void onVerifyMfa()} disabled={busy !== null || otp.trim().length < 6}>
              {busy === "verify" ? "Verifying..." : "Verify & Enable MFA"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void onDisableMfa()} disabled={busy !== null || otp.trim().length < 6}>
              {busy === "disable" ? "Disabling..." : "Disable MFA"}
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
