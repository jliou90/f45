import { API_BASE_ORIGIN } from "../../lib/kutm";

export type ConnectivityStatus = "online" | "degraded" | "offline";
export type ConnectivityReason = "browser_offline" | "health_failed" | "recovering" | "ok";

export type ConnectivitySnapshot = {
  status: ConnectivityStatus;
  lastSuccessAt: string | null;
  lastTransitionAt: string;
  reason: ConnectivityReason;
};

type Listener = (snapshot: ConnectivitySnapshot) => void;

const OFFLINE_AFTER_MS = 30_000;
const PING_TIMEOUT_MS = 4_500;
const MAX_BACKOFF_MS = 20_000;
const ONLINE_POLL_MS = 10_000;
const ENDPOINTS = ["/api/v1/ops/health", "/api/v1/health"];

function nowIso(): string {
  return new Date().toISOString();
}

function defaultSnapshot(): ConnectivitySnapshot {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  return {
    status: online ? "degraded" : "offline",
    lastSuccessAt: null,
    lastTransitionAt: nowIso(),
    reason: online ? "recovering" : "browser_offline",
  };
}

async function pingEndpoint(path: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_ORIGIN}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      credentials: "omit",
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export class ConnectivityService {
  private snapshot: ConnectivitySnapshot = defaultSnapshot();
  private listeners = new Set<Listener>();
  private startedAt = Date.now();
  private failureStartedAt: number | null = null;
  private attempt = 0;
  private timer: number | null = null;
  private running = false;

  private emit(next: ConnectivitySnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  private updateStatus(status: ConnectivityStatus, reason: ConnectivityReason): void {
    if (this.snapshot.status === status && this.snapshot.reason === reason) {
      return;
    }
    this.emit({
      status,
      reason,
      lastSuccessAt: this.snapshot.lastSuccessAt,
      lastTransitionAt: nowIso(),
    });
  }

  private markSuccess(): void {
    this.attempt = 0;
    this.failureStartedAt = null;
    this.emit({
      status: "online",
      reason: "ok",
      lastSuccessAt: nowIso(),
      lastTransitionAt: this.snapshot.status === "online" ? this.snapshot.lastTransitionAt : nowIso(),
    });
  }

  private markFailure(): void {
    const now = Date.now();
    if (this.failureStartedAt === null) {
      this.failureStartedAt = now;
    }
    const bootAge = now - this.startedAt;
    const consecutiveFailureAge = now - this.failureStartedAt;
    if (bootAge >= OFFLINE_AFTER_MS && consecutiveFailureAge >= OFFLINE_AFTER_MS) {
      this.updateStatus("offline", "health_failed");
      return;
    }
    this.updateStatus("degraded", "recovering");
  }

  private scheduleNext(): void {
    if (!this.running) {
      return;
    }
    const delay =
      this.snapshot.status === "online" ? ONLINE_POLL_MS : Math.min(1000 * 2 ** this.attempt, MAX_BACKOFF_MS);
    if (this.timer) {
      window.clearTimeout(this.timer);
    }
    this.timer = window.setTimeout(() => {
      void this.check();
    }, delay);
  }

  private async check(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Background-tab timer throttling can trigger false negatives; don't degrade while hidden.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      this.scheduleNext();
      return;
    }

    // navigator.onLine is unreliable on localhost in some browsers (notably Firefox).
    // Keep probing backend health and only mark hard-offline when probes fail consistently.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.updateStatus("degraded", "browser_offline");
    }

    const checks = await Promise.all(ENDPOINTS.map((path) => pingEndpoint(path)));
    if (checks.some(Boolean)) {
      this.markSuccess();
    } else {
      this.attempt += 1;
      this.markFailure();
    }
    this.scheduleNext();
  }

  private onOnline = () => {
    this.updateStatus("degraded", "recovering");
    void this.check();
  };

  private onOffline = () => {
    this.updateStatus("degraded", "browser_offline");
  };

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.startedAt = Date.now();
    this.attempt = 0;
    this.failureStartedAt = null;
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    void this.check();
  }

  stop(): void {
    this.running = false;
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getSnapshot(): ConnectivitySnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const connectivityService = new ConnectivityService();
