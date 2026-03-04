import { RingBuffer } from "./ring-buffer";
import { redactPii, redactSecrets } from "./redaction";
import type { OpsConsoleEvent, OpsErrorEvent, OpsLogLevel, OpsNetworkEvent, OpsPerformanceEvent, OpsSnapshot } from "./types";

type OpsListener = (snapshot: OpsSnapshot) => void;

type PersistedPayload = {
  savedAt: string;
  snapshot: OpsSnapshot;
};

const SESSION_KEY = "kutm:ops:snapshot";
const MAX_ERRORS = 200;
const MAX_CONSOLE = 300;
const MAX_NETWORK = 500;
const MAX_PERF = 400;
const PERSIST_MAX_ERRORS = 80;
const PERSIST_MAX_CONSOLE = 80;
const PERSIST_MAX_NETWORK = 120;
const PERSIST_MAX_PERF = 120;
const PERSIST_DEBOUNCE_MS = 1500;

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const errorBuffer = new RingBuffer<OpsErrorEvent>(MAX_ERRORS);
const consoleBuffer = new RingBuffer<OpsConsoleEvent>(MAX_CONSOLE);
const networkBuffer = new RingBuffer<OpsNetworkEvent>(MAX_NETWORK);
const perfBuffer = new RingBuffer<OpsPerformanceEvent>(MAX_PERF);
const listeners = new Set<OpsListener>();

let enabled = true;
let logLevel: OpsLogLevel = "error";
let persistTimer: number | null = null;

function levelRank(level: OpsLogLevel): number {
  if (level === "error") return 1;
  if (level === "warn") return 2;
  if (level === "info") return 3;
  return 4;
}

function persistSnapshot(snapshot: OpsSnapshot): void {
  if (typeof window === "undefined") return;
  const trimmed: OpsSnapshot = {
    enabled: snapshot.enabled,
    logLevel: snapshot.logLevel,
    errors: snapshot.errors.slice(0, PERSIST_MAX_ERRORS),
    consoleEvents: snapshot.consoleEvents.slice(0, PERSIST_MAX_CONSOLE),
    network: snapshot.network.slice(0, PERSIST_MAX_NETWORK),
    performance: snapshot.performance.slice(0, PERSIST_MAX_PERF),
  };
  const payload: PersistedPayload = {
    savedAt: new Date().toISOString(),
    snapshot: trimmed,
  };
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore sessionStorage write errors.
  }
}

function schedulePersist(snapshot: OpsSnapshot): void {
  if (typeof window === "undefined") return;
  if (persistTimer !== null) {
    window.clearTimeout(persistTimer);
  }
  persistTimer = window.setTimeout(() => {
    persistSnapshot(snapshot);
    persistTimer = null;
  }, PERSIST_DEBOUNCE_MS);
}

function notify(): void {
  const snapshot = getOpsSnapshot();
  schedulePersist(snapshot);
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function parseArgs(args: unknown[]): string[] {
  return args.map((item) => redactSecrets(typeof item === "string" ? item : JSON.stringify(item)));
}

export function rehydrateOpsSnapshot(): void {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw) as PersistedPayload;
    for (const item of payload.snapshot.errors.slice().reverse()) {
      errorBuffer.push(item);
    }
    for (const item of payload.snapshot.consoleEvents.slice().reverse()) {
      consoleBuffer.push(item);
    }
    for (const item of payload.snapshot.network.slice().reverse()) {
      networkBuffer.push(item);
    }
    for (const item of payload.snapshot.performance.slice().reverse()) {
      perfBuffer.push(item);
    }
    enabled = payload.snapshot.enabled;
    logLevel = payload.snapshot.logLevel;
  } catch {
    // Ignore invalid session snapshot.
  }
}

export function getOpsSnapshot(): OpsSnapshot {
  return {
    enabled,
    logLevel,
    errors: errorBuffer.toArray(),
    consoleEvents: consoleBuffer.toArray(),
    network: networkBuffer.toArray(),
    performance: perfBuffer.toArray(),
  };
}

export function setOpsCaptureEnabled(next: boolean): void {
  enabled = next;
  notify();
}

export function setOpsLogLevel(level: OpsLogLevel): void {
  logLevel = level;
  notify();
}

export function addOpsError(args: Omit<OpsErrorEvent, "id" | "at">): void {
  if (!enabled) return;
  errorBuffer.push({
    ...args,
    id: makeId("err"),
    at: new Date().toISOString(),
  });
  notify();
}

export function addOpsConsole(level: OpsLogLevel, args: unknown[]): void {
  if (!enabled) return;
  if (levelRank(level) > levelRank(logLevel)) return;
  consoleBuffer.push({
    id: makeId("log"),
    at: new Date().toISOString(),
    level,
    args: parseArgs(args),
  });
  notify();
}

export function addOpsNetwork(event: Omit<OpsNetworkEvent, "id" | "at">): void {
  if (!enabled) return;
  networkBuffer.push({
    ...event,
    id: makeId("net"),
    at: new Date().toISOString(),
  });
  notify();
}

export function addOpsPerformance(event: Omit<OpsPerformanceEvent, "id" | "at">): void {
  if (!enabled) return;
  perfBuffer.push({
    ...event,
    id: makeId("perf"),
    at: new Date().toISOString(),
  });
  notify();
}

export function subscribeOps(listener: OpsListener): () => void {
  listeners.add(listener);
  listener(getOpsSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function exportOpsBundle(args: {
  appVersion: string;
  tenantId: string | null;
  backendStatus: unknown;
}): string {
  const snapshot = getOpsSnapshot();
  const payload = {
    generatedAt: new Date().toISOString(),
    appVersion: args.appVersion,
    tenantId: args.tenantId,
    network: snapshot.network.map((item) => ({ ...item, url: redactPii(item.url) })),
    errors: snapshot.errors.map((item) => ({ ...item, message: redactPii(item.message) })),
    performance: snapshot.performance,
    backendStatus: args.backendStatus,
  };
  return JSON.stringify(payload, null, 2);
}
