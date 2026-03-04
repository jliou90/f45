import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { setAccessToken, setRefreshToken } from "../auth/tokenStore";
import { setTenantId } from "../auth/tenantStore";
describe("apiClient", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        setAccessToken(undefined);
        setRefreshToken(undefined);
        setTenantId(undefined);
    });
    it("attaches Authorization and X-Tenant-Id", async () => {
        setAccessToken("access_1");
        setTenantId("t1");
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" }
        }));
        await apiClient.request({ method: "GET", path: "/me" });
        const call = fetchMock.mock.calls[0];
        expect(call).toBeTruthy();
        const init = call?.[1];
        const headers = init.headers;
        expect(headers.Authorization).toBe("Bearer access_1");
        expect(headers["X-Tenant-Id"]).toBe("t1");
    });
    it("converts 412 into ConflictError", async () => {
        setAccessToken("access_1");
        setTenantId("t1");
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "conflict", message: "Precondition failed" } }), {
            status: 412,
            headers: { "content-type": "application/json" }
        }));
        await expect(apiClient.request({ method: "PATCH", path: "/customers/c1", body: { name: "x" }, ifMatch: '"e1"' })).rejects.toMatchObject({ kind: "conflict_error", entityType: "customer", entityId: "c1" });
    });
});
