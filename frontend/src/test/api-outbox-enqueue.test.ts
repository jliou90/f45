import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../lib/api";
import { enqueueOutbox } from "../lib/outbox";

vi.mock("../lib/outbox", () => ({
  enqueueOutbox: vi.fn(async (item) => item),
}));

vi.mock("../lib/window-sync", () => ({
  publishWindowSync: vi.fn(),
}));

describe("ApiClient outbox enqueue", () => {
  it("enqueues write requests when network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network down"))));

    const client = new ApiClient({
      baseUrl: "http://127.0.0.1:8010/api/v1",
      getAccessToken: () => "access",
      getRefreshToken: () => "refresh",
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
      getTenantId: () => "tenant-1",
    });

    await expect(client.post("/dms/appointments", { status: "NEW" })).rejects.toBeInstanceOf(ApiError);

    expect(enqueueOutbox).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(enqueueOutbox).mock.calls[0][0];
    expect(payload.method).toBe("POST");
    expect(payload.path).toBe("/dms/appointments");
    expect(payload.withTenant).toBe(true);
    expect(typeof payload.idempotencyKey).toBe("string");
  });
});
