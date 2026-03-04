import { getStoredAccessToken, getStoredTenantId } from "./storage";
import { getTelemetrySnapshot } from "./telemetry";
import { publishWindowSync } from "./window-sync";

export type OutboxMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type OutboxItem = {
  id: string;
  createdAt: string;
  method: OutboxMethod;
  path: string;
  body?: unknown;
  withTenant: boolean;
  idempotencyKey: string;
  retryCount: number;
  lastError?: string;
};

type OutboxStoreEvent = {
  type: "changed";
};

type OutboxListener = (event: OutboxStoreEvent) => void;

type OutboxSummary = {
  total: number;
  byMethod: Record<OutboxMethod, number>;
  oldestCreatedAt: string | null;
  newestCreatedAt: string | null;
};

const DB_NAME = "kutm-shell";
const DB_VERSION = 1;
const STORE_NAME = "outbox";
const listeners = new Set<OutboxListener>();

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `outbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function notifyOutboxChanged(payload?: Record<string, unknown>) {
  for (const listener of listeners) {
    listener({ type: "changed" });
  }
  publishWindowSync({ type: "OUTBOX_UPDATED", payload });
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  if (!isIndexedDbAvailable()) {
    throw new Error("IndexedDB is unavailable in this browser");
  }
  const database = await openDb();
  try {
    const tx = database.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await fn(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
    return result;
  } finally {
    database.close();
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function normalizeMethod(value: string): OutboxMethod {
  if (value === "POST" || value === "PUT" || value === "PATCH" || value === "DELETE") {
    return value;
  }
  return "POST";
}

export async function list(): Promise<OutboxItem[]> {
  return withStore("readonly", async (store) => {
    const all = (await requestToPromise(store.getAll())) as OutboxItem[];
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
}

export async function getOutboxItem(id: string): Promise<OutboxItem | null> {
  return withStore("readonly", async (store) => {
    const item = (await requestToPromise(store.get(id))) as OutboxItem | undefined;
    return item ?? null;
  });
}

export async function enqueue(input: Omit<OutboxItem, "id" | "createdAt" | "retryCount"> & { retryCount?: number }): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: newId(),
    createdAt: new Date().toISOString(),
    method: normalizeMethod(input.method),
    path: input.path.startsWith("/") ? input.path : `/${input.path}`,
    body: input.body,
    withTenant: input.withTenant,
    idempotencyKey: input.idempotencyKey,
    retryCount: input.retryCount ?? 0,
    lastError: input.lastError,
  };

  await withStore("readwrite", async (store) => {
    await requestToPromise(store.put(item));
    return undefined;
  });
  notifyOutboxChanged({ action: "enqueued", id: item.id, path: item.path, method: item.method });
  return item;
}

export async function updateOutboxItem(item: OutboxItem): Promise<void> {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.put(item));
    return undefined;
  });
  notifyOutboxChanged({ action: "updated", id: item.id, path: item.path, method: item.method });
}

export async function del(id: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.delete(id));
    return undefined;
  });
  notifyOutboxChanged({ action: "removed", id });
}

export async function clear(): Promise<void> {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.clear());
    return undefined;
  });
  notifyOutboxChanged({ action: "cleared" });
}

export function subscribeOutbox(listener: OutboxListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function shouldRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes("password") || lower.includes("token") || lower.includes("secret") || lower.includes("authorization");
}

export function redactSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (shouldRedactKey(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    result[key] = redactSensitiveData(entry);
  }
  return result;
}

export async function retry(id: string): Promise<void> {
  const item = await getOutboxItem(id);
  if (!item) {
    return;
  }

  try {
    const { kutmApi } = await import("./kutm");
    await kutmApi.request(item.method, item.path, {
      body: item.body,
      withTenant: item.withTenant,
      headers: { "Idempotency-Key": item.idempotencyKey },
      withIdempotencyKey: false,
    });
    await del(item.id);
  } catch (error) {
    await updateOutboxItem({
      ...item,
      retryCount: item.retryCount + 1,
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function retryAll(): Promise<void> {
  const items = await list();
  for (const item of items) {
    await retry(item.id);
  }
}

export async function autoReplay(): Promise<void> {
  const ready = Boolean(getTelemetrySnapshot().backendConnected && getStoredAccessToken() && getStoredTenantId());
  if (!ready) {
    return;
  }
  await retryAll();
}

export async function getOutboxSummary(): Promise<OutboxSummary> {
  const items = await list();
  const byMethod: Record<OutboxMethod, number> = {
    POST: 0,
    PUT: 0,
    PATCH: 0,
    DELETE: 0,
  };
  for (const item of items) {
    byMethod[item.method] += 1;
  }
  return {
    total: items.length,
    byMethod,
    oldestCreatedAt: items[0]?.createdAt ?? null,
    newestCreatedAt: items.at(-1)?.createdAt ?? null,
  };
}

// Backward-compatible exports during migration.
export const enqueueOutbox = enqueue;
export const listOutboxItems = list;
export const deleteOutboxItem = del;
export const clearOutbox = clear;
export const retryOutboxItem = retry;
export const retryAllOutboxItems = retryAll;
export { del as delete };
