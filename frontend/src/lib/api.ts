import { enqueueOutbox } from "./outbox";
import { addRequestLog, setBackendConnected } from "./telemetry";

export type ErrorEnvelope = {
  code?: string;
  message?: string;
  detail?: string;
  details?: unknown;
  request_id?: string | null;
};

export class ApiError extends Error {
  status: number;
  url: string;
  method: HttpMethod;
  request_id: string | null;
  body?: unknown;

  constructor(args: {
    status: number;
    url: string;
    method: HttpMethod;
    message: string;
    request_id?: string | null;
    body?: unknown;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.url = args.url;
    this.method = args.method;
    this.request_id = args.request_id ?? null;
    this.body = args.body;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
  getTenantId: () => string | null;
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type QueryParams = Record<string, string | number | boolean | undefined | null>;

type RequestOptions = {
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  withTenant?: boolean;
  withIdempotencyKey?: boolean;
  skipAuthRefresh?: boolean;
};

type RequestInternalOptions = RequestOptions & {
  retryAttempted?: boolean;
  networkRetryAttempt?: number;
};

type TokenPair = {
  access_token: string;
  refresh_token: string;
};

const NON_QUEUEABLE_AUTH_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);
const AUTH_HEADER_EXEMPT_PATHS = new Set(["/auth/login", "/auth/refresh"]);

function resolveBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1";
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return new URL(normalizedPath, origin).toString().replace(/\/+$/, "");
}

function isWriteMethod(method: HttpMethod): boolean {
  return method !== "GET";
}

function shouldAttachAuthorization(path: string): boolean {
  return !AUTH_HEADER_EXEMPT_PATHS.has(path);
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseErrorEnvelope(body: unknown): ErrorEnvelope | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  if ("error" in record && record.error && typeof record.error === "object") {
    return record.error as ErrorEnvelope;
  }
  return record as ErrorEnvelope;
}

function extractRequestId(response: Response, payload: unknown): string | null {
  const envelope = parseErrorEnvelope(payload);
  const headerRequestId = response.headers.get("x-request-id") ?? response.headers.get("X-Request-Id");
  if (envelope?.request_id) {
    return envelope.request_id;
  }
  if (typeof headerRequestId === "string" && headerRequestId.length > 0) {
    return headerRequestId;
  }
  const record = payload as Record<string, unknown> | null;
  const direct = record && typeof record.request_id === "string" ? record.request_id : null;
  return direct ?? null;
}

function toErrorMessage(statusText: string, envelope: ErrorEnvelope | null): string {
  if (!envelope) return statusText || "Request failed";
  if (typeof envelope.message === "string" && envelope.message.length > 0) return envelope.message;
  if (typeof envelope.detail === "string" && envelope.detail.length > 0) return envelope.detail;
  return statusText || "Request failed";
}

function backoffMs(attempt: number): number {
  return 250 * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => string | null;
  private readonly getRefreshToken: () => string | null;
  private readonly setTokens: (accessToken: string, refreshToken: string) => void;
  private readonly clearTokens: () => void;
  private readonly getTenantId: () => string | null;
  private refreshPromise: Promise<void> | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.getAccessToken = options.getAccessToken;
    this.getRefreshToken = options.getRefreshToken;
    this.setTokens = options.setTokens;
    this.clearTokens = options.clearTokens;
    this.getTenantId = options.getTenantId;
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const endpointPath = path.startsWith("/") ? path : `/${path}`;
    const basePath = `${this.baseUrl}${endpointPath}`;
    if (!query) {
      return basePath;
    }
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        search.set(key, String(value));
      }
    }
    const suffix = search.toString();
    return suffix.length > 0 ? `${basePath}?${suffix}` : basePath;
  }

  private async parsePayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    return isJson ? response.json() : response.text();
  }

  private async refreshAccessToken(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      throw new Error("Missing refresh token");
    }

    const startedAt = Date.now();
    this.refreshPromise = (async () => {
      const refreshUrl = this.buildUrl("/auth/refresh");
      let response: Response;
      try {
        response = await fetch(refreshUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": newIdempotencyKey(),
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (error) {
        setBackendConnected(false);
        addRequestLog({
          method: "POST",
          url: refreshUrl,
          path: "/auth/refresh",
          status: 0,
          success: false,
          durationMs: Date.now() - startedAt,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      const payload = await this.parsePayload(response);
      const durationMs = Date.now() - startedAt;
      setBackendConnected(true);

      if (!response.ok) {
        this.clearTokens();
        const envelope = parseErrorEnvelope(payload);
        const requestId = extractRequestId(response, payload);
        addRequestLog({
          method: "POST",
          url: refreshUrl,
          path: "/auth/refresh",
          status: response.status,
          success: false,
          durationMs,
          request_id: requestId,
          errorMessage: toErrorMessage(response.statusText, envelope),
        });
        throw new ApiError({
          status: response.status,
          url: refreshUrl,
          method: "POST",
          message: toErrorMessage(response.statusText, envelope),
          request_id: requestId,
          body: payload,
        });
      }

      const tokenPair = payload as TokenPair;
      if (!tokenPair.access_token || !tokenPair.refresh_token) {
        this.clearTokens();
        throw new Error("Refresh endpoint returned malformed token pair");
      }
      this.setTokens(tokenPair.access_token, tokenPair.refresh_token);
      addRequestLog({
        method: "POST",
        url: refreshUrl,
        path: "/auth/refresh",
        status: response.status,
        success: true,
        durationMs,
        request_id: extractRequestId(response, payload),
      });
    })();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async request<T>(method: HttpMethod, path: string, options?: RequestInternalOptions): Promise<T> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = this.buildUrl(path, options?.query);
    const startedAt = Date.now();
    const headers: Record<string, string> = {
      ...(options?.headers ?? {}),
    };
    headers["X-Client-Request-Id"] = headers["X-Client-Request-Id"] ?? newClientRequestId();

    const token = this.getAccessToken();
    if (token && shouldAttachAuthorization(normalizedPath)) {
      headers.Authorization = `Bearer ${token}`;
    }

    const withTenant = options?.withTenant ?? true;
    if (withTenant) {
      const tenantId = this.getTenantId();
      if (!tenantId) {
        throw new ApiError({
          status: 400,
          url,
          method,
          message: "Tenant id is required for this request",
          body: { code: "tenant_required", path: normalizedPath },
        });
      }
      headers["X-Tenant-Id"] = tenantId;
    }

    const withIdempotencyKey = options?.withIdempotencyKey ?? true;
    if (isWriteMethod(method) && withIdempotencyKey && !headers["Idempotency-Key"]) {
      headers["Idempotency-Key"] = newIdempotencyKey();
    }
    const idempotencyKey = headers["Idempotency-Key"];

    const body = options?.body;
    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      setBackendConnected(false);

      const networkRetryAttempt = options?.networkRetryAttempt ?? 0;
      if (method === "GET" && networkRetryAttempt < 2) {
        await sleep(backoffMs(networkRetryAttempt));
        return this.request<T>(method, path, {
          ...options,
          networkRetryAttempt: networkRetryAttempt + 1,
        });
      }

      const isQueueable = isWriteMethod(method) && !NON_QUEUEABLE_AUTH_PATHS.has(normalizedPath) && Boolean(idempotencyKey);
      if (isQueueable) {
        await enqueueOutbox({
          method: method as "POST" | "PUT" | "PATCH" | "DELETE",
          path: normalizedPath,
          body,
          withTenant,
          idempotencyKey: idempotencyKey!,
        });
      }

      addRequestLog({
        method,
        url,
        path: normalizedPath,
        status: 0,
        success: false,
        durationMs,
        errorMessage: error instanceof Error ? error.message : String(error),
        idempotencyKey,
      });

      throw new ApiError({
        status: 0,
        url,
        method,
        message: error instanceof Error ? error.message : "Network request failed",
        body: { queued: isQueueable },
      });
    }

    const payload = await this.parsePayload(response);
    const durationMs = Date.now() - startedAt;
    setBackendConnected(true);

    if (response.ok) {
      addRequestLog({
        method,
        url,
        path: normalizedPath,
        status: response.status,
        success: true,
        durationMs,
        request_id: extractRequestId(response, payload),
        idempotencyKey,
      });
      return payload as T;
    }

    const skipAuthRefresh = options?.skipAuthRefresh ?? false;
    const isUnauthorized = response.status === 401;
    const canRetryWithRefresh = !options?.retryAttempted && !skipAuthRefresh && isUnauthorized && Boolean(this.getRefreshToken());
    if (canRetryWithRefresh) {
      await this.refreshAccessToken();
      return this.request<T>(method, path, { ...options, retryAttempted: true });
    }

    const envelope = parseErrorEnvelope(payload);
    const requestId = extractRequestId(response, payload);

    addRequestLog({
      method,
      url,
      path: normalizedPath,
      status: response.status,
      success: false,
      durationMs,
      request_id: requestId,
      errorMessage: toErrorMessage(response.statusText, envelope),
      idempotencyKey,
    });

    throw new ApiError({
      status: response.status,
      url,
      method,
      message: toErrorMessage(response.statusText, envelope),
      request_id: requestId,
      body: payload,
    });
  }

  get<T>(path: string, query?: QueryParams, withTenant = true): Promise<T> {
    return this.request<T>("GET", path, { query, withTenant });
  }

  post<T>(path: string, body?: unknown, withTenant = true): Promise<T> {
    return this.request<T>("POST", path, { body, withTenant });
  }

  put<T>(path: string, body?: unknown, withTenant = true): Promise<T> {
    return this.request<T>("PUT", path, { body, withTenant });
  }

  patch<T>(path: string, body?: unknown, withTenant = true): Promise<T> {
    return this.request<T>("PATCH", path, { body, withTenant });
  }

  delete<T>(path: string, withTenant = true): Promise<T> {
    return this.request<T>("DELETE", path, { withTenant });
  }
}
