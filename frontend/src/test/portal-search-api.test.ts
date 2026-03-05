import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSavedPortalSearches, savePortalSearchQuery, searchPortal } from "../modules/portal-search/api";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "test-rid" },
  });
}

describe("portal search api", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    sessionStorage.clear();
  });

  it("maps portal search response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/api/v1/portal/search?")) {
          return mockResponse({
            query: "riley",
            modules: ["customers", "accounting"],
            facets: { customers: 2, accounting: 1 },
            items: [
              {
                module: "customers",
                entity_id: "cust-1",
                title: "Riley Gray",
                subtitle: "CUST-123",
                status: "active",
                updated_at: "2026-03-05T00:00:00Z",
                url: "/dms/customers/cust-1",
              },
            ],
          });
        }
        return mockResponse({ ok: true });
      }),
    );

    const result = await searchPortal("riley");
    expect(result.facets.customers).toBe(2);
    expect(result.items[0].entityId).toBe("cust-1");
    expect(result.items[0].url).toBe("/dms/customers/cust-1");
  });

  it("stores and loads saved search queries", () => {
    savePortalSearchQuery("Riley");
    savePortalSearchQuery("Accounting Review");
    savePortalSearchQuery("riley");

    const saved = loadSavedPortalSearches();
    expect(saved[0]).toBe("riley");
    expect(saved[1]).toBe("Accounting Review");
    expect(saved).toHaveLength(2);
  });
});
