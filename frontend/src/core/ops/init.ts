import { addOpsConsole, addOpsError, addOpsNetwork, addOpsPerformance, rehydrateOpsSnapshot } from "./store";
import { sanitizeUrl } from "./redaction";

let initialized = false;
let fetchWrapped = false;

function installErrorCapture(): void {
  window.addEventListener("error", (event) => {
    addOpsError({
      type: "window.onerror",
      message: event.message || "Unhandled window error",
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    addOpsError({
      type: "unhandledrejection",
      message,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

function installConsoleCapture(): void {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    addOpsConsole("debug", args);
    originalLog(...args);
  };

  console.warn = (...args: unknown[]) => {
    addOpsConsole("warn", args);
    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    addOpsConsole("error", args);
    originalError(...args);
  };
}

function installFetchCapture(): void {
  if (fetchWrapped) {
    return;
  }
  fetchWrapped = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now();
    const method = init?.method?.toUpperCase() ?? "GET";
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const { url, path } = sanitizeUrl(rawUrl);

    try {
      const response = await originalFetch(input, init);
      const durationMs = performance.now() - started;
      addOpsNetwork({
        method,
        url,
        path,
        status: response.status,
        durationMs,
        requestId: response.headers.get("x-request-id"),
        clientRequestId: (init?.headers as Record<string, string> | undefined)?.["X-Client-Request-Id"] ?? null,
        payloadBytes: Number(response.headers.get("content-length") ?? "0") || null,
        ok: response.ok,
      });
      return response;
    } catch (error) {
      const durationMs = performance.now() - started;
      addOpsNetwork({
        method,
        url,
        path,
        status: 0,
        durationMs,
        requestId: null,
        clientRequestId: (init?.headers as Record<string, string> | undefined)?.["X-Client-Request-Id"] ?? null,
        payloadBytes: null,
        ok: false,
      });
      throw error;
    }
  };
}

function installPerformanceCapture(): void {
  performance.mark("app_boot");

  if (typeof PerformanceObserver !== "function") {
    return;
  }

  const observer = new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      if (entry.entryType === "navigation") {
        addOpsPerformance({ kind: "navigation", name: entry.name || "navigation", value: entry.duration, unit: "ms" });
      }
      if (entry.entryType === "longtask") {
        addOpsPerformance({ kind: "longtask", name: entry.name || "longtask", value: entry.duration, unit: "ms" });
      }
      if (entry.entryType === "paint") {
        addOpsPerformance({ kind: "vital", name: entry.name.toUpperCase(), value: entry.startTime, unit: "ms" });
      }
    }
  });

  observer.observe({ type: "navigation", buffered: true });
  try {
    observer.observe({ type: "longtask", buffered: true });
  } catch {
    // longtask not supported in every browser.
  }
  observer.observe({ type: "paint", buffered: true });
}

export function markOpsMilestone(name: "auth_ready" | "tenant_ready" | "first_route_render"): void {
  performance.mark(name);
  addOpsPerformance({ kind: "mark", name, value: performance.now(), unit: "ms" });
}

export function initOpsInstrumentation(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  rehydrateOpsSnapshot();
  installErrorCapture();
  installConsoleCapture();
  installFetchCapture();
  installPerformanceCapture();
}
