import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { API_BASE_ORIGIN, API_BASE_URL } from "../lib/kutm";
import { getAllFeatureFlagsSnapshot, getFeatureFlags } from "../lib/feature-flags";
import { getBrandingSnapshot, getTenantBranding } from "../lib/branding";
import { getOutboxSummary } from "../lib/outbox";
import { buildDebugBundle, buildSupportBundle, getTelemetrySnapshot, subscribeTelemetry, type RequestLogEntry } from "../lib/telemetry";
import { APP_VERSION } from "../lib/version";
import { checkContractDrift, checkRequiredRoutes } from "../lib/contracts";
import { getAllPluginRouteRequirements } from "../plugins/registry";
import { useAuth } from "./use-auth";
import { useTenant } from "./use-tenant";
import { TelemetryContext, type TelemetryContextValue } from "./telemetry-state";

type OpenApiDoc = {
  paths?: Record<string, Record<string, unknown>>;
};

async function fetchOpenApiDoc(): Promise<OpenApiDoc | null> {
  try {
    const response = await fetch(`${API_BASE_ORIGIN}/openapi.json`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as OpenApiDoc;
  } catch {
    return null;
  }
}

function downloadJsonFile(filename: string, payload: string): void {
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<RequestLogEntry[]>(() => getTelemetrySnapshot().logs);
  const [backendConnected, setBackendConnectedState] = useState<boolean>(() => getTelemetrySnapshot().backendConnected);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auth = useAuth();
  const tenant = useTenant();

  useEffect(() => {
    return subscribeTelemetry((snapshot) => {
      setLogs(snapshot.logs);
      setBackendConnectedState(snapshot.backendConnected);
    });
  }, []);

  const copyDebugBundle = useCallback(async () => {
    const bundle = buildDebugBundle({
      appVersion: APP_VERSION,
      mode: import.meta.env.MODE,
      baseUrl: API_BASE_URL,
      userEmail: auth.user?.email,
      tenantId: tenant.tenantId,
      lastLogs: 100,
    });
    await navigator.clipboard.writeText(bundle);
  }, [auth.user?.email, tenant.tenantId]);

  const downloadSupportBundle = useCallback(async () => {
    const [outboxSummary, openApiDoc] = await Promise.all([getOutboxSummary(), fetchOpenApiDoc()]);
    const pluginRequirements = getAllPluginRouteRequirements({
      featureFlags: getFeatureFlags(tenant.tenantId) as Record<string, boolean | string | number>,
      isDev: import.meta.env.DEV,
    });
    const contractRequired = openApiDoc
      ? checkRequiredRoutes(openApiDoc, pluginRequirements)
      : { ok: false, missing: [{ path: "(openapi)", method: "GET" }], present: [], pluginMissing: {}, pluginPresent: {}, generatedCount: 0 };
    const drift = openApiDoc ? checkContractDrift(openApiDoc) : { missingInRuntime: [], missingInGenerated: [] };
    const bundle = buildSupportBundle({
      appVersion: APP_VERSION,
      mode: import.meta.env.MODE,
      baseUrl: API_BASE_URL,
      currentRoute: window.location.pathname,
      userEmail: auth.user?.email,
      tenantId: tenant.tenantId,
      tenantRole: tenant.currentRole,
      outboxSummary,
      featureFlags: getFeatureFlags(tenant.tenantId),
      featureFlagsSnapshot: getAllFeatureFlagsSnapshot(),
      branding: getTenantBranding(tenant.tenantId),
      brandingSnapshot: getBrandingSnapshot(),
      contractDrift: {
        requiredOk: contractRequired.ok,
        missingRequiredCount: contractRequired.missing.length,
        missingInRuntimeCount: drift.missingInRuntime.length,
        missingInGeneratedCount: drift.missingInGenerated.length,
        missingRequired: contractRequired.missing,
      },
    });
    downloadJsonFile(`kutm-support-${Date.now()}.json`, bundle);
  }, [auth.user?.email, tenant.tenantId, tenant.currentRole]);

  const value = useMemo<TelemetryContextValue>(
    () => ({
      logs,
      backendConnected,
      drawerOpen,
      setDrawerOpen,
      copyDebugBundle,
      downloadSupportBundle,
    }),
    [logs, backendConnected, drawerOpen, copyDebugBundle, downloadSupportBundle],
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

