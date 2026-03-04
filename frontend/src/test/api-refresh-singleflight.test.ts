import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../lib/api";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Unauthorized",
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("ApiClient refresh single-flight", () => {
  it("reuses one refresh promise for concurrent 401 requests", async () => {
    let accessToken = "old-token";
    let refreshCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(200, { access_token: "new-token", refresh_token: "new-refresh" });
      }

      if (url.endsWith("/secure")) {
        const authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization;
        if (authHeader === "Bearer old-token") {
          return jsonResponse(401, { error: { message: "expired", request_id: "req-401" } });
        }
        return jsonResponse(200, { ok: true });
      }

      return jsonResponse(404, { error: { message: "unknown" } });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({
      baseUrl: "http://127.0.0.1:8010/api/v1",
      getAccessToken: () => accessToken,
      getRefreshToken: () => "refresh-token",
      setTokens: (nextAccessToken) => {
        accessToken = nextAccessToken;
      },
      clearTokens: vi.fn(),
      getTenantId: () => "tenant-1",
    });

    const [a, b] = await Promise.all([client.get<{ ok: boolean }>("/secure"), client.get<{ ok: boolean }>("/secure")]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(refreshCalls).toBe(1);
  });
});
