import { hasRoute } from "../gen/openapi-endpoints";
import type { Branding } from "./branding";
import { setTenantBranding } from "./branding";
import { kutmApi } from "./kutm";
import { publishWindowSync } from "./window-sync";

export type FeatureFlags = {
  commsEnabled: boolean;
  accountingBeta: boolean;
  realtimeEnabled: boolean;
  pdfExportEnabled: boolean;
  diagnosticsEnabled: boolean;
  scaffoldEnabled: boolean;
} & Record<string, boolean | string | number>;

type FeatureFlagsEnvelope = {
  flags?: Record<string, boolean | string | number>;
  tenantId?: string;
  role?: string;
  branding?: Branding;
};

type FeatureFlagListener = (tenantId: string, flags: FeatureFlags, branding?: Branding) => void;

const DEFAULT_FLAGS: FeatureFlags = {
  commsEnabled: true,
  accountingBeta: true,
  realtimeEnabled: false,
  pdfExportEnabled: true,
  diagnosticsEnabled: import.meta.env.DEV,
  scaffoldEnabled: false,
};

const flagsByTenant = new Map<string, FeatureFlags>();
const listeners = new Set<FeatureFlagListener>();

function normalizeFlags(input?: Record<string, boolean | string | number>): FeatureFlags {
  const diagnosticsEnabled = input?.diagnosticsEnabled ?? input?.["diagnostics.enabled"];
  const commsEnabled = input?.commsEnabled ?? input?.["comms.enabled"];
  const accountingBeta = input?.accountingBeta ?? input?.["service.betaScheduler"];
  const scaffoldEnabled = input?.scaffoldEnabled ?? input?.["scaffold.enabled"];
  return {
    ...DEFAULT_FLAGS,
    ...(input ?? {}),
    commsEnabled: Boolean(commsEnabled ?? DEFAULT_FLAGS.commsEnabled),
    accountingBeta: Boolean(accountingBeta ?? DEFAULT_FLAGS.accountingBeta),
    realtimeEnabled: Boolean(input?.realtimeEnabled ?? DEFAULT_FLAGS.realtimeEnabled),
    pdfExportEnabled: Boolean(input?.pdfExportEnabled ?? DEFAULT_FLAGS.pdfExportEnabled),
    diagnosticsEnabled: Boolean(diagnosticsEnabled ?? DEFAULT_FLAGS.diagnosticsEnabled),
    scaffoldEnabled: Boolean(scaffoldEnabled ?? DEFAULT_FLAGS.scaffoldEnabled),
  };
}

function notify(tenantId: string, flags: FeatureFlags, branding?: Branding) {
  for (const listener of listeners) {
    listener(tenantId, flags, branding);
  }
}

export function getFeatureFlags(tenantId: string | null | undefined): FeatureFlags {
  if (!tenantId) return DEFAULT_FLAGS;
  return flagsByTenant.get(tenantId) ?? DEFAULT_FLAGS;
}

export function setFeatureFlagsForTenant(
  tenantId: string,
  flags: Record<string, boolean | string | number>,
  branding?: Branding,
  broadcast = true,
): FeatureFlags {
  const normalized = normalizeFlags(flags);
  flagsByTenant.set(tenantId, normalized);
  if (branding) {
    setTenantBranding(tenantId, branding, broadcast);
  }
  notify(tenantId, normalized, branding);
  if (broadcast) {
    publishWindowSync({
      type: "FEATURE_FLAGS_UPDATED",
      payload: { tenantId, flags: normalized, branding: branding ?? null },
    });
  }
  return normalized;
}

async function fetchFlags(path: string): Promise<FeatureFlagsEnvelope | null> {
  try {
    const response = await kutmApi.get<FeatureFlagsEnvelope>(path, undefined, true);
    return response;
  } catch {
    return null;
  }
}

function devFallbackFlags(tenantId: string): FeatureFlagsEnvelope {
  return {
    tenantId,
    flags: DEFAULT_FLAGS,
  };
}

export async function loadFeatureFlags(tenantId: string): Promise<FeatureFlags> {
  let payload: FeatureFlagsEnvelope | null = null;

  payload = await fetchFlags("/admin/feature-flags/effective");

  if (payload && !payload.tenantId) {
    payload = { ...payload, tenantId };
  }

  if (!payload && hasRoute("/api/v1/platform/feature-flags", "GET")) {
    payload = await fetchFlags("/platform/feature-flags");
  }

  if (!payload && hasRoute("/api/v1/ops/feature-flags", "GET")) {
    payload = await fetchFlags("/ops/feature-flags");
  }

  if (!payload && import.meta.env.DEV) {
    payload = devFallbackFlags(tenantId);
  }

  const effectiveTenantId = payload?.tenantId ?? tenantId;
  return setFeatureFlagsForTenant(effectiveTenantId, payload?.flags ?? DEFAULT_FLAGS, payload?.branding, true);
}

export function subscribeFeatureFlags(listener: FeatureFlagListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAllFeatureFlagsSnapshot(): Record<string, FeatureFlags> {
  return Object.fromEntries(flagsByTenant.entries());
}
