import { useMemo } from "react";
import { useAuth } from "../app/use-auth";
import { useFeatureFlags } from "../app/use-feature-flags";
import { useTelemetry } from "../app/use-telemetry";
import { useTenant } from "../app/use-tenant";
import { getTenantBranding, type ResolvedBranding } from "../lib/branding";
import { kutmApi } from "../lib/kutm";
import {
  clearOutbox,
  deleteOutboxItem,
  enqueueOutbox,
  listOutboxItems,
  retryAllOutboxItems,
  retryOutboxItem,
  type OutboxItem,
} from "../lib/outbox";
import { addRequestLog } from "../lib/telemetry";

export type PluginContext = {
  api: typeof kutmApi;
  auth: {
    user: ReturnType<typeof useAuth>["user"];
    logout: ReturnType<typeof useAuth>["logout"];
    refresh: ReturnType<typeof useAuth>["refresh"];
    loadMe: ReturnType<typeof useAuth>["loadMe"];
  };
  tenant: {
    tenantId: ReturnType<typeof useTenant>["tenantId"];
    currentRole: ReturnType<typeof useTenant>["currentRole"];
    currentTenant: ReturnType<typeof useTenant>["currentTenant"];
    selectTenant: ReturnType<typeof useTenant>["selectTenant"];
    refreshCurrentTenant: ReturnType<typeof useTenant>["refreshCurrentTenant"];
  };
  featureFlags: ReturnType<typeof useFeatureFlags>["flags"];
  branding: ResolvedBranding;
  telemetry: {
    logRequest: typeof addRequestLog;
    exportSupportBundle: () => Promise<void>;
    copyDebugBundle: () => Promise<void>;
  };
  outbox: {
    enqueue: typeof enqueueOutbox;
    list: () => Promise<OutboxItem[]>;
    retry: (id: string) => Promise<void>;
    retryAll: () => Promise<void>;
    delete: (id: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  registerRoutes: (..._args: unknown[]) => void;
  registerNavItems: (..._args: unknown[]) => void;
  registerCommands: (..._args: unknown[]) => void;
  registerLauncherTiles: (..._args: unknown[]) => void;
};

export function usePluginContext(): PluginContext {
  const auth = useAuth();
  const tenant = useTenant();
  const featureFlags = useFeatureFlags();
  const telemetry = useTelemetry();

  return useMemo<PluginContext>(() => {
    const branding = getTenantBranding(tenant.tenantId);

    return {
      api: kutmApi,
      auth: {
        user: auth.user,
        logout: auth.logout,
        refresh: auth.refresh,
        loadMe: auth.loadMe,
      },
      tenant: {
        tenantId: tenant.tenantId,
        currentRole: tenant.currentRole,
        currentTenant: tenant.currentTenant,
        selectTenant: tenant.selectTenant,
        refreshCurrentTenant: tenant.refreshCurrentTenant,
      },
      featureFlags: featureFlags.flags,
      branding,
      telemetry: {
        logRequest: addRequestLog,
        exportSupportBundle: telemetry.downloadSupportBundle,
        copyDebugBundle: telemetry.copyDebugBundle,
      },
      outbox: {
        enqueue: enqueueOutbox,
        list: listOutboxItems,
        retry: retryOutboxItem,
        retryAll: retryAllOutboxItems,
        delete: deleteOutboxItem,
        clear: clearOutbox,
      },
      registerRoutes: () => undefined,
      registerNavItems: () => undefined,
      registerCommands: () => undefined,
      registerLauncherTiles: () => undefined,
    };
  }, [auth, featureFlags.flags, telemetry, tenant]);
}

