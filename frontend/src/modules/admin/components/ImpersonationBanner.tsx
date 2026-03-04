import { useAuth } from "../../../app/use-auth";
import { Button } from "../../../ui";
import { adminExitImpersonation } from "../api";
import { stopImpersonation, useImpersonationState } from "../state/impersonation";

export function ImpersonationBanner() {
  const auth = useAuth();
  const state = useImpersonationState();

  if (!state.isImpersonating || !state.impersonatedUser) {
    return null;
  }

  const onExit = async () => {
    try {
      if (state.backendEnabled) {
        await adminExitImpersonation();
      }
      stopImpersonation();
      await auth.loadMe();
    } catch {
      // Keep this UI-safe and reversible even when backend exit is unavailable.
      stopImpersonation();
    }
  };

  return (
    <div className="banner" style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "center" }}>
      <strong>Impersonating:</strong>
      <span>{state.impersonatedUser.displayName || state.impersonatedUser.email}</span>
      <span className="muted" style={{ color: "#f9fafb" }}>
        Original: {state.originalUser?.email ?? "unknown"}
      </span>
      <Button type="button" variant="secondary" onClick={() => void onExit()}>
        Exit impersonation
      </Button>
    </div>
  );
}
