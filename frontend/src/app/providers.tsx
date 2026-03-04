import type { ReactNode } from "react";
import { AuthProvider } from "./auth-provider";
import { ConnectivityProvider } from "./connectivity-provider";
import { FeatureFlagsProvider } from "./feature-flags-provider";
import { OutboxWorker } from "./outbox-worker";
import { TenantProvider } from "./tenant-provider";
import { TelemetryProvider } from "./telemetry-provider";
import { ToastProvider } from "./toast-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConnectivityProvider>
        <AuthProvider>
          <TenantProvider>
            <FeatureFlagsProvider>
              <TelemetryProvider>
                {children}
                <OutboxWorker />
              </TelemetryProvider>
            </FeatureFlagsProvider>
          </TenantProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </ToastProvider>
  );
}
