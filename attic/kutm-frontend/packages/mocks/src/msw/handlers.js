import { HttpResponse, http } from "msw";
import { consumeConflictOnce, getFixtures, setCustomer } from "../data/fixtures";
function requireAuthAndTenant(req) {
    const auth = req.headers.get("authorization");
    const tenant = req.headers.get("x-tenant-id");
    if (!auth?.startsWith("Bearer ")) {
        return HttpResponse.json({ error: { code: "unauthorized", message: "Missing auth" } }, { status: 401 });
    }
    if (!tenant) {
        return HttpResponse.json({ error: { code: "validation_error", message: "Missing X-Tenant-Id" } }, { status: 400 });
    }
    return null;
}
export const handlers = [
    http.post("/api/auth/login", () => HttpResponse.json({ accessToken: "access_1", refreshToken: "refresh_1", expiresInSec: 900 })),
    http.post("/api/auth/refresh", async ({ request }) => {
        const body = (await request.json());
        if (body.refreshToken !== "refresh_1") {
            return HttpResponse.json({ error: { code: "unauthorized", message: "Invalid refresh token" } }, { status: 401 });
        }
        return HttpResponse.json({ accessToken: "access_2", refreshToken: "refresh_1", expiresInSec: 900 });
    }),
    http.get("/api/me", ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
            return HttpResponse.json({ error: { code: "unauthorized", message: "Missing auth" } }, { status: 401 });
        }
        return HttpResponse.json({
            user: { id: "u1", name: "Demo User" },
            tenants: [{ id: "t1", name: "Demo Rooftop" }],
            defaultApps: ["customer"],
            permissions: ["customer.read", "customer.write", "locks.acquire"]
        });
    }),
    http.get("/api/customers/:id", ({ request, params }) => {
        const authError = requireAuthAndTenant(request);
        if (authError) {
            return authError;
        }
        if (params.id !== "c1") {
            return HttpResponse.json({ error: { code: "not_found", message: "Missing customer" } }, { status: 404 });
        }
        const fixtures = getFixtures();
        return HttpResponse.json(fixtures.customer, {
            headers: { ETag: fixtures.customerEtag, "x-request-id": "r-get-c1" }
        });
    }),
    http.patch("/api/customers/:id", async ({ request, params }) => {
        const authError = requireAuthAndTenant(request);
        if (authError) {
            return authError;
        }
        if (params.id !== "c1") {
            return HttpResponse.json({ error: { code: "not_found", message: "Missing customer" } }, { status: 404 });
        }
        const fixtures = getFixtures();
        const ifMatch = request.headers.get("if-match") ?? undefined;
        if (consumeConflictOnce()) {
            return HttpResponse.json({
                error: { code: "conflict", message: "Precondition failed", requestId: "r1" },
                currentEtag: fixtures.customerEtag,
                serverSnapshot: fixtures.customer
            }, { status: 412, headers: { "x-request-id": "r1" } });
        }
        if (ifMatch && ifMatch !== fixtures.customerEtag) {
            return HttpResponse.json({
                error: { code: "conflict", message: "Precondition failed", requestId: "r2" },
                currentEtag: fixtures.customerEtag,
                serverSnapshot: fixtures.customer
            }, { status: 412, headers: { "x-request-id": "r2" } });
        }
        const body = (await request.json());
        const next = {
            ...fixtures.customer,
            ...body,
            name: body.name ?? "Alex Customer Updated"
        };
        setCustomer(next, '"c_etag_v2"');
        return HttpResponse.json(next, { headers: { ETag: '"c_etag_v2"', "x-request-id": "r3" } });
    }),
    http.post("/api/locks/acquire", ({ request }) => {
        const authError = requireAuthAndTenant(request);
        if (authError) {
            return authError;
        }
        return HttpResponse.json({ ok: true });
    }),
    http.post("/api/locks/release", ({ request }) => {
        const authError = requireAuthAndTenant(request);
        if (authError) {
            return authError;
        }
        return HttpResponse.json({ ok: true });
    }),
    http.get("/api/customers/:id/audit", ({ request, params }) => {
        const authError = requireAuthAndTenant(request);
        if (authError) {
            return authError;
        }
        if (params.id !== "c1") {
            return HttpResponse.json({ events: [] });
        }
        return HttpResponse.json({
            events: [
                {
                    ts: "2026-02-27T12:00:00Z",
                    actor: "u1",
                    action: "updated",
                    diff: { name: ["Alex Customer", "Alex Customer Updated"] }
                }
            ]
        });
    })
];
