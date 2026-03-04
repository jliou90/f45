import { hasRoute } from "../gen/openapi-endpoints";
import type { PluginContext } from "../plugins/context";
import type { ModulePlugin } from "../plugins/types";
import { API_BASE_URL } from "./kutm";

export type RealtimeEvent = {
  type: string;
  topic?: string;
  payload?: Record<string, unknown>;
};

export type RealtimeStatus = "Live" | "Offline" | "Disabled";

type RealtimeOptions = {
  enabled: boolean;
  plugins: ModulePlugin[];
  ctx: PluginContext;
  onUnauthorized?: () => void;
};

type RealtimeConnection = {
  stop: () => void;
};

type StatusListener = (status: RealtimeStatus) => void;

const statusListeners = new Set<StatusListener>();
let currentStatus: RealtimeStatus = "Offline";
let loggedMissingEndpoint = false;

function setStatus(status: RealtimeStatus) {
  currentStatus = status;
  for (const listener of statusListeners) {
    listener(status);
  }
}

export function getRealtimeStatus(): RealtimeStatus {
  return currentStatus;
}

export function subscribeRealtimeStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

function resolveWsUrl(): string {
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  const wsOrigin = origin.replace(/^http/, "ws");
  return `${wsOrigin}/api/v1/ops/events/ws`;
}

function resolveSseUrl(): string {
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${origin}/api/v1/ops/events`;
}

function parseEventPayload(raw: string): RealtimeEvent | null {
  try {
    const parsed = JSON.parse(raw) as RealtimeEvent;
    if (!parsed || typeof parsed.type !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function dispatchToPlugins(event: RealtimeEvent, plugins: ModulePlugin[], ctx: PluginContext): void {
  for (const plugin of plugins) {
    const realtime = plugin.realtime;
    if (!realtime) continue;
    const topic = event.topic ?? event.type;
    if (!realtime.topics.includes(topic)) continue;
    realtime.onEvent(event, ctx);
  }
}

function hasRealtimeEndpoint(): boolean {
  return hasRoute("/api/v1/ops/events", "GET");
}

async function probeRealtimeEndpoint(): Promise<"ok" | "unauthorized" | "unavailable"> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(resolveSseUrl(), {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      return "unauthorized";
    }
    // Explicitly disable realtime when backend exposes stub/unimplemented endpoints.
    if (response.status === 404 || response.status === 405 || response.status === 501) {
      return "unavailable";
    }
    return "ok";
  } catch {
    // On network/proxy issues we keep previous behavior and allow reconnect logic.
    return "ok";
  } finally {
    window.clearTimeout(timer);
  }
}

export function startRealtime(options: RealtimeOptions): RealtimeConnection {
  if (!options.enabled) {
    setStatus("Disabled");
    return { stop: () => undefined };
  }

  if (!hasRealtimeEndpoint()) {
    setStatus("Disabled");
    if (!loggedMissingEndpoint) {
      loggedMissingEndpoint = true;
      console.info("Realtime disabled: endpoint not present in OpenAPI.");
    }
    return { stop: () => undefined };
  }

  let stopped = false;
  let retries = 0;
  let socket: WebSocket | null = null;
  let source: EventSource | null = null;
  let retryTimeout: number | null = null;

  const scheduleReconnect = (connect: () => void) => {
    if (stopped) return;
    retries += 1;
    const delay = Math.min(30000, 500 * 2 ** retries);
    retryTimeout = window.setTimeout(() => {
      connect();
    }, delay);
  };

  const cleanup = () => {
    if (retryTimeout) {
      window.clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
    if (source) {
      source.close();
      source = null;
    }
  };

  const onUnauthorized = () => {
    setStatus("Disabled");
    options.onUnauthorized?.();
    cleanup();
  };

  const onEvent = (event: RealtimeEvent) => {
    if (event.type === "unauthorized" || event.payload?.status === 401) {
      onUnauthorized();
      return;
    }
    dispatchToPlugins(event, options.plugins, options.ctx);
  };

  const connectSse = () => {
    if (stopped) return;
    setStatus("Offline");
    try {
      source = new EventSource(resolveSseUrl(), { withCredentials: true });
    } catch {
      scheduleReconnect(connectSse);
      return;
    }

    source.onopen = () => {
      retries = 0;
      setStatus("Live");
    };

    source.onmessage = (message) => {
      const event = parseEventPayload(message.data);
      if (!event) return;
      onEvent(event);
    };

    source.onerror = () => {
      setStatus("Offline");
      if (source) {
        source.close();
        source = null;
      }
      scheduleReconnect(connectSse);
    };
  };

  const connectWs = () => {
    if (stopped) return;
    setStatus("Offline");
    try {
      socket = new WebSocket(resolveWsUrl());
    } catch {
      connectSse();
      return;
    }

    socket.onopen = () => {
      retries = 0;
      setStatus("Live");
    };

    socket.onmessage = (message) => {
      const event = parseEventPayload(String(message.data));
      if (!event) return;
      onEvent(event);
    };

    socket.onerror = () => {
      setStatus("Offline");
    };

    socket.onclose = (event) => {
      if (stopped) return;
      if (event.code === 1008 || event.code === 4401) {
        onUnauthorized();
        return;
      }
      socket = null;
      connectSse();
    };
  };

  void (async () => {
    const probe = await probeRealtimeEndpoint();
    if (probe === "unauthorized") {
      onUnauthorized();
      return;
    }
    if (probe === "unavailable") {
      setStatus("Disabled");
      if (!loggedMissingEndpoint) {
        loggedMissingEndpoint = true;
        console.info("Realtime disabled: /api/v1/ops/events is unavailable.");
      }
      return;
    }
    connectWs();
  })();

  return {
    stop: () => {
      stopped = true;
      cleanup();
      setStatus("Offline");
    },
  };
}
