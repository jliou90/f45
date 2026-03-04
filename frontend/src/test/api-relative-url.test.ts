import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../lib/api";

describe("ApiClient relative baseUrl", () => {
  it("resolves same-origin URLs for relative API paths", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
      json: async () => ({ access_token: "acc-token", refresh_token: "ref-token" }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({
      baseUrl: "/api/v1",
      getAccessToken: () => null,
      getRefreshToken: () => null,
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
      getTenantId: () => null,
    });

    await client.post("/auth/login", { email: "alice@example.com", password: "secret" }, false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${window.location.origin}/api/v1/auth/login`);
  });
});
