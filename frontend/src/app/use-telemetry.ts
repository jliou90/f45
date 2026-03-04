import { useContext } from "react";
import { TelemetryContext } from "./telemetry-state";

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error("useTelemetry must be used inside TelemetryProvider");
  }
  return context;
}

