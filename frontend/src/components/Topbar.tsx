import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/use-auth";
import { useTenant } from "../app/use-tenant";
import { useTelemetry } from "../app/use-telemetry";
import type { ThemeMode } from "../lib/prefs";
import { adminExitImpersonation } from "../modules/admin/api";
import { stopImpersonation, useImpersonationState } from "../modules/admin/state/impersonation";

type TopbarProps = {
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  realtimeStatus: "Live" | "Offline" | "Disabled";
};

export function Topbar({ themeMode, onToggleTheme, realtimeStatus }: TopbarProps) {
  const navigate = useNavigate();
  const auth = useAuth();
  const tenant = useTenant();
  const telemetry = useTelemetry();
  const impersonation = useImpersonationState();

  return (
    <header className="topbar">
      <div>
        <div>
          User: <strong>{auth.user?.email ?? "(none)"}</strong>
        </div>
        <div className="muted">
          Tenant: {tenant.tenantName ?? "(not selected)"} {tenant.tenantId ? `(${tenant.tenantId})` : ""}
        </div>
      </div>
      <button
        type="button"
        aria-label="Log out"
        onClick={() => {
          stopImpersonation();
          auth.logout();
          tenant.clearTenant();
        }}
      >
        Logout
      </button>
      <button type="button" aria-label="Switch tenant" onClick={() => navigate("/tenant-picker")}>
        Switch Tenant
      </button>
      {impersonation.isImpersonating ? (
        <button
          type="button"
          aria-label="Exit impersonation"
          onClick={() => {
            void (async () => {
              try {
                if (impersonation.backendEnabled) {
                  await adminExitImpersonation();
                }
              } finally {
                stopImpersonation();
              }
            })();
          }}
        >
          Exit Impersonation
        </button>
      ) : null}
      <button type="button" aria-label="Toggle theme" onClick={onToggleTheme}>
        Theme: {themeMode}
      </button>
      <button type="button" aria-label="Open request log drawer" onClick={() => telemetry.setDrawerOpen(true)}>
        Request Log
      </button>
      <span className={realtimeStatus === "Live" ? "badge ok" : realtimeStatus === "Disabled" ? "badge neutral" : "badge warn"}>
        {realtimeStatus}
      </span>
      <span className="muted">Ctrl+K</span>
    </header>
  );
}
