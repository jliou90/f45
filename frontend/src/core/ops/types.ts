export type OpsLogLevel = "error" | "warn" | "info" | "debug";

export type OpsErrorEvent = {
  id: string;
  at: string;
  message: string;
  stack?: string;
  type: "window.onerror" | "unhandledrejection" | "react-error-boundary";
};

export type OpsConsoleEvent = {
  id: string;
  at: string;
  level: OpsLogLevel;
  args: string[];
};

export type OpsNetworkEvent = {
  id: string;
  at: string;
  method: string;
  url: string;
  path: string;
  status: number;
  durationMs: number;
  requestId: string | null;
  clientRequestId: string | null;
  payloadBytes: number | null;
  ok: boolean;
};

export type OpsPerformanceEvent = {
  id: string;
  at: string;
  kind: "navigation" | "resource" | "longtask" | "vital" | "mark";
  name: string;
  value: number;
  unit: "ms" | "score";
};

export type OpsSnapshot = {
  enabled: boolean;
  logLevel: OpsLogLevel;
  errors: OpsErrorEvent[];
  consoleEvents: OpsConsoleEvent[];
  network: OpsNetworkEvent[];
  performance: OpsPerformanceEvent[];
};
