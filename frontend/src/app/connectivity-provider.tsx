import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { connectivityService, type ConnectivitySnapshot } from "../core/connectivity/service";
import { ConnectivityContext } from "./connectivity-context";
import type { ConnectivityContextValue } from "./connectivity-state";
import { useToast } from "./use-toast";

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(() => connectivityService.getSnapshot());
  const previousStatus = useRef(snapshot.status);

  useEffect(() => {
    connectivityService.start();
    return () => {
      connectivityService.stop();
    };
  }, []);

  useEffect(() => {
    return connectivityService.subscribe((next) => {
      setSnapshot(next);
    });
  }, []);

  useEffect(() => {
    const previous = previousStatus.current;
    if (previous !== "offline" && snapshot.status === "offline") {
      toast.pushToast("error", "You appear to be offline. We will keep retrying.");
    }
    if (previous === "offline" && snapshot.status === "online") {
      toast.pushToast("success", "Back online.");
    }
    previousStatus.current = snapshot.status;
  }, [snapshot.status, toast]);

  const value = useMemo<ConnectivityContextValue>(
    () => ({
      snapshot: {
        status: snapshot.status,
        lastSuccessAt: snapshot.lastSuccessAt,
        lastTransitionAt: snapshot.lastTransitionAt,
        reason: snapshot.reason,
      },
    }),
    [snapshot],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}
