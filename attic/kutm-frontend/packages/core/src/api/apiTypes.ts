export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type ApiError = {
  kind: "api_error";
  status: number;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};

export type ConflictError = ApiError & {
  kind: "conflict_error";
  entityType: string;
  entityId: string;
  currentEtag?: string;
  attemptedIfMatch?: string;
  serverSnapshot?: unknown;
};

export type ApiResponse<T> = {
  data: T;
  etag?: string;
  requestId?: string;
};

export type RequestOptions<TBody = unknown> = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  headers?: Record<string, string>;
  tenantId?: string;
  ifMatch?: string;
};

export interface ApiClient {
  request<TResp, TBody = unknown>(opts: RequestOptions<TBody>): Promise<ApiResponse<TResp>>;
}
