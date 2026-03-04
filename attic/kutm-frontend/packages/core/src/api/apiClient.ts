import { getAccessToken, getRefreshToken, setAccessToken } from "../auth/tokenStore";
import { getTenantId } from "../auth/tenantStore";
import type { ApiClient, ApiError, ApiResponse, ConflictError, RequestOptions } from "./apiTypes";

const FALLBACK_BASE_URL = "/api";
let configuredBaseUrl = FALLBACK_BASE_URL;

export function configureApiClient(config: { baseUrl?: string }) {
  const nextBaseUrl = config.baseUrl?.trim();
  configuredBaseUrl = nextBaseUrl && nextBaseUrl.length > 0 ? nextBaseUrl : FALLBACK_BASE_URL;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const asRelative = path.startsWith("http")
    ? path
    : `${configuredBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const url = new URL(
    asRelative,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function parseEntityFromPath(path: string) {
  const cleanPath = path.split("?")[0] ?? "";
  const parts = cleanPath.split("/").filter(Boolean);
  const maybeId = parts[parts.length - 1] ?? "unknown";
  const maybePlural = parts[parts.length - 2] ?? "entity";
  return {
    entityType: maybePlural.endsWith("s") ? maybePlural.slice(0, -1) : maybePlural,
    entityId: maybeId
  };
}

async function parseBody(resp: Response) {
  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return resp.json();
  }
  return undefined;
}

async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const resp = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!resp.ok) {
    return false;
  }

  const data = (await parseBody(resp)) as { accessToken?: string } | undefined;
  if (!data?.accessToken) {
    return false;
  }

  setAccessToken(data.accessToken);
  return true;
}

function toApiError(status: number, body: unknown, requestId?: string): ApiError {
  const castBody = body as { error?: { code?: string; message?: string; requestId?: string } };
  return {
    kind: "api_error",
    status,
    code: castBody?.error?.code ?? "unknown",
    message: castBody?.error?.message ?? `Request failed with status ${status}`,
    requestId: requestId ?? castBody?.error?.requestId,
    details: body
  };
}

function toConflictError(
  status: number,
  body: unknown,
  opts: RequestOptions,
  requestId?: string
): ConflictError {
  const castBody = body as {
    error?: { message?: string; requestId?: string };
    currentEtag?: string;
    serverSnapshot?: unknown;
  };
  const entityRef = parseEntityFromPath(opts.path);
  return {
    kind: "conflict_error",
    status,
    code: "conflict",
    message: castBody?.error?.message ?? "Conflict",
    requestId: requestId ?? castBody?.error?.requestId,
    details: body,
    entityType: entityRef.entityType,
    entityId: entityRef.entityId,
    attemptedIfMatch: opts.ifMatch,
    currentEtag: castBody?.currentEtag,
    serverSnapshot: castBody?.serverSnapshot
  } as unknown as ConflictError;
}

export function isConflictError(e: unknown): e is ConflictError {
  return Boolean(e && typeof e === "object" && (e as { kind?: string }).kind === "conflict_error");
}

async function execute<TResp, TBody>(opts: RequestOptions<TBody>): Promise<ApiResponse<TResp>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(opts.headers ?? {})
  };

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const tenantId = opts.tenantId ?? getTenantId();
  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }

  if (opts.ifMatch) {
    headers["If-Match"] = opts.ifMatch;
  }

  const resp = await fetch(buildUrl(opts.path, opts.query), {
    method: opts.method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });

  const requestId = resp.headers.get("x-request-id") ?? undefined;
  const body = await parseBody(resp);

  if (!resp.ok) {
    if (resp.status === 409 || resp.status === 412) {
      throw toConflictError(resp.status, body, opts, requestId);
    }
    throw toApiError(resp.status, body, requestId);
  }

  return {
    data: body as TResp,
    etag: resp.headers.get("etag") ?? undefined,
    requestId: requestId ?? (body as { requestId?: string } | undefined)?.requestId
  };
}

export const apiClient: ApiClient = {
  async request<TResp, TBody = unknown>(opts: RequestOptions<TBody>): Promise<ApiResponse<TResp>> {
    try {
      return await execute<TResp, TBody>(opts);
    } catch (e) {
      const err = e as ApiError;
      if (err.kind === "api_error" && err.status === 401) {
        const refreshed = await doRefresh();
        if (refreshed) {
          return execute<TResp, TBody>(opts);
        }
      }
      throw e;
    }
  }
};
