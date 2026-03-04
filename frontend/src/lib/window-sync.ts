export type WindowSyncEventType =
  | "LOGOUT"
  | "TENANT_CHANGED"
  | "THEME_CHANGED"
  | "FEATURE_FLAGS_UPDATED"
  | "OUTBOX_UPDATED"
  | "BRANDING_UPDATED"
  | "OPS_CAPTURE_UPDATED"
  | "OPS_LOG_LEVEL_UPDATED"
  | "OPS_EXPORT_TRIGGERED";

export type WindowSyncEvent = {
  type: WindowSyncEventType;
  payload?: Record<string, unknown>;
};

type BroadcastMessage = WindowSyncEvent & {
  sourceId: string;
  at: string;
};

type WindowSyncListener = (event: WindowSyncEvent) => void;

const CHANNEL_NAME = "kutm";
const STORAGE_KEY = "kutm:sync";
const listeners = new Set<WindowSyncListener>();
const sourceId =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

let channel: BroadcastChannel | null = null;
let storageSubscribed = false;

function notify(event: WindowSyncEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

function parseIncoming(data: unknown): BroadcastMessage | null {
  if (!data || typeof data !== "object") return null;
  const message = data as BroadcastMessage;
  if (message.sourceId === sourceId) return null;
  if (typeof message.type !== "string") return null;
  return message;
}

function ensureStorageFallback() {
  if (storageSubscribed || typeof window === "undefined") return;
  storageSubscribed = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as BroadcastMessage;
      const parsed = parseIncoming(message);
      if (!parsed) return;
      notify({ type: parsed.type, payload: parsed.payload });
    } catch {
      // Ignore malformed sync events.
    }
  });
}

function ensureChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof window === "undefined" || typeof window.BroadcastChannel === "undefined") {
    ensureStorageFallback();
    return null;
  }
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (message) => {
    const data = parseIncoming(message.data);
    if (!data) return;
    notify({ type: data.type, payload: data.payload });
  };
  return channel;
}

export function publishWindowSync(event: WindowSyncEvent): void {
  const payload: BroadcastMessage = {
    ...event,
    sourceId,
    at: new Date().toISOString(),
  };

  const bc = ensureChannel();
  if (bc) {
    bc.postMessage(payload);
  } else if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage sync failures.
    }
  }

  notify(event);
}

export function subscribeWindowSync(listener: WindowSyncListener): () => void {
  listeners.add(listener);
  ensureChannel();
  ensureStorageFallback();
  return () => {
    listeners.delete(listener);
  };
}

export function closeWindowSyncChannel(): void {
  if (channel) {
    channel.close();
    channel = null;
  }
}
