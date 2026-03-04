export type ConnectivityStatus = "online" | "degraded" | "offline";

export type ConnectivitySnapshot = {
  status: ConnectivityStatus;
  lastSuccessAt: string | null;
  lastTransitionAt: string;
  reason: "browser_offline" | "health_failed" | "recovering" | "ok";
};

export type ConnectivityContextValue = {
  snapshot: ConnectivitySnapshot;
};
