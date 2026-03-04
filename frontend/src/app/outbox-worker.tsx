import { useEffect } from "react";
import { useAuth } from "./use-auth";
import { useTenant } from "./use-tenant";
import { useTelemetry } from "./use-telemetry";
import { useToast } from "./use-toast";
import { autoReplay } from "../lib/outbox";

export function OutboxWorker() {
  const auth = useAuth();
  const tenant = useTenant();
  const telemetry = useTelemetry();
  const toast = useToast();

  useEffect(() => {
    if (!auth.isAuthenticated || !tenant.tenantId || !telemetry.backendConnected) {
      return;
    }

    let cancelled = false;

    const replay = async () => {
      if (cancelled) return;
      try {
        await autoReplay();
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 401) {
          toast.pushToast("error", "Outbox replay stopped: unauthorized.");
        }
      }
    };

    void replay();
    const intervalId = window.setInterval(() => {
      void replay();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [auth.isAuthenticated, tenant.tenantId, telemetry.backendConnected, toast]);

  return null;
}

