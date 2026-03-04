import type { FeatureFlags } from "./feature-flags";
import type { ResolvedBranding } from "./branding";

type OutboxSummary = {
  total: number;
  byMethod: Record<string, number>;
  oldestCreatedAt: string | null;
  newestCreatedAt: string | null;
};

type ContractDriftSummary = {
  requiredOk: boolean;
  missingRequiredCount: number;
  missingInRuntimeCount: number;
  missingInGeneratedCount: number;
  missingRequired?: Array<{ path: string; method: string }>;
};

export type RequestLogEntry = {
  id: string;
  method: string;
  url: string;
  path: string;
  status: number;
  success: boolean;
  durationMs: number;
  time: string;
  request_id?: string | null;
  errorMessage?: string;
  idempotencyKey?: string;
};

type TelemetrySnapshot = {
  logs: RequestLogEntry[];
  backendConnected: boolean;
};

type TelemetryListener = (snapshot: TelemetrySnapshot) => void;

const MAX_LOGS = 400;
const listeners = new Set<TelemetryListener>();
let logs: RequestLogEntry[] = [];
let backendConnected = true;

function notify() {
  const snapshot: TelemetrySnapshot = { logs, backendConnected };
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function redactLog(log: RequestLogEntry): RequestLogEntry {
  return {
    ...log,
    url: log.url.replace(/(access_token|refresh_token|token)=([^&]+)/gi, "$1=[REDACTED]"),
  };
}

export function addRequestLog(entry: Omit<RequestLogEntry, "id" | "time">) {
  const normalized: RequestLogEntry = {
    ...entry,
    id: newId(),
    time: new Date().toISOString(),
  };
  logs = [normalized, ...logs].slice(0, MAX_LOGS);
  notify();
}

export function setBackendConnected(value: boolean) {
  if (backendConnected !== value) {
    backendConnected = value;
    notify();
  }
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  return {
    logs,
    backendConnected,
  };
}

export function subscribeTelemetry(listener: TelemetryListener): () => void {
  listeners.add(listener);
  listener(getTelemetrySnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function buildDebugBundle(args: {
  appVersion: string;
  mode: string;
  baseUrl: string;
  userEmail?: string | null;
  tenantId?: string | null;
  lastLogs?: number;
}): string {
  const snapshot = getTelemetrySnapshot();
  const limit = args.lastLogs ?? 50;
  const trimmedLogs = snapshot.logs.slice(0, limit).map((log) => redactLog(log));
  const payload = {
    generatedAt: new Date().toISOString(),
    appVersion: args.appVersion,
    mode: args.mode,
    baseUrl: args.baseUrl,
    userEmail: args.userEmail ?? null,
    tenantId: args.tenantId ?? null,
    backendConnected: snapshot.backendConnected,
    logs: trimmedLogs,
  };
  return JSON.stringify(payload, null, 2);
}

export function buildSupportBundle(args: {
  appVersion: string;
  mode: string;
  baseUrl: string;
  currentRoute: string;
  userEmail?: string | null;
  tenantId?: string | null;
  tenantRole?: string | null;
  outboxSummary: OutboxSummary;
  featureFlags: FeatureFlags;
  featureFlagsSnapshot: Record<string, FeatureFlags>;
  branding: ResolvedBranding;
  brandingSnapshot: Record<string, ResolvedBranding>;
  contractDrift: ContractDriftSummary;
}): string {
  const snapshot = getTelemetrySnapshot();
  const trimmedLogs = snapshot.logs.slice(0, 200).map((log) => redactLog(log));
  const payload = {
    generatedAt: new Date().toISOString(),
    appVersion: args.appVersion,
    mode: args.mode,
    baseUrl: args.baseUrl,
    currentRoute: args.currentRoute,
    userEmail: args.userEmail ?? null,
    tenant_id: args.tenantId ?? null,
    tenant_role: args.tenantRole ?? null,
    backendConnected: snapshot.backendConnected,
    requestLogs: trimmedLogs,
    outboxSummary: args.outboxSummary,
    featureFlags: args.featureFlags,
    featureFlagsSnapshot: args.featureFlagsSnapshot,
    branding: args.branding,
    brandingSnapshot: args.brandingSnapshot,
    contractDrift: args.contractDrift,
  };
  return JSON.stringify(payload, null, 2);
}
