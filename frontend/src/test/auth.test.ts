import { beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "../lib/auth";
import { STORAGE_KEYS } from "../lib/storage";

describe("auth login", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends expected login payload and stores tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
      json: async () => ({
        access_token: "acc-token",
        refresh_token: "ref-token",
        token_type: "bearer",
      }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await login("alice@example.com", "secret");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "alice@example.com", password: "secret" }));
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");

    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBe("acc-token");
    expect(sessionStorage.getItem(STORAGE_KEYS.refreshToken)).toBe("ref-token");
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.refreshToken)).toBeNull();
  });

  it("does not send stale Authorization header to login", async () => {
    localStorage.setItem(STORAGE_KEYS.accessToken, "stale-access");
    localStorage.setItem(STORAGE_KEYS.refreshToken, "stale-refresh");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
      json: async () => ({
        access_token: "fresh-access",
        refresh_token: "fresh-refresh",
        token_type: "bearer",
      }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await login("alice@example.com", "secret");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
