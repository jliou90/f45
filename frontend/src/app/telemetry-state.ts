import { createContext } from "react";
import type { RequestLogEntry } from "../lib/telemetry";

export type TelemetryContextValue = {
  logs: RequestLogEntry[];
  backendConnected: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (value: boolean) => void;
  copyDebugBundle: () => Promise<void>;
  downloadSupportBundle: () => Promise<void>;
};

export const TelemetryContext = createContext<TelemetryContextValue | null>(null);

