import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getFeatureFlags,
  loadFeatureFlags,
  setFeatureFlagsForTenant,
  subscribeFeatureFlags,
} from "../lib/feature-flags";
import { setTenantBranding } from "../lib/branding";
import { subscribeWindowSync } from "../lib/window-sync";
import { useTenant } from "./use-tenant";
import { FeatureFlagsContext, type FeatureFlagsContextValue } from "./feature-flags-state";

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  const [, setRevision] = useState(0);
  const flags = getFeatureFlags(tenant.tenantId);

  useEffect(() => {
    if (!tenant.tenantId) return;
    void loadFeatureFlags(tenant.tenantId);
  }, [tenant.tenantId]);

  useEffect(() => {
    return subscribeFeatureFlags((updatedTenantId, _updatedFlags, branding) => {
      if (updatedTenantId === tenant.tenantId) {
        if (branding) {
          setTenantBranding(updatedTenantId, branding, false);
        }
        setRevision((value) => value + 1);
      }
    });
  }, [tenant.tenantId]);

  useEffect(() => {
    return subscribeWindowSync((event) => {
      if (event.type !== "FEATURE_FLAGS_UPDATED") return;
      const payloadTenantId = event.payload?.tenantId;
      const payloadFlags = event.payload?.flags as Record<string, boolean | string | number> | undefined;
      const payloadBranding = event.payload?.branding as { brandName?: string; primaryColor?: string; secondaryColor?: string; logoUrl?: string } | undefined;
      if (typeof payloadTenantId !== "string") return;
      if (payloadFlags) {
        setFeatureFlagsForTenant(payloadTenantId, payloadFlags, payloadBranding, false);
        return;
      }
      if (payloadTenantId === tenant.tenantId) {
        void loadFeatureFlags(payloadTenantId);
      }
    });
  }, [tenant.tenantId]);

  const reload = useCallback(async () => {
    if (!tenant.tenantId) return;
    await loadFeatureFlags(tenant.tenantId);
  }, [tenant.tenantId]);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      reload,
    }),
    [flags, reload],
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}
