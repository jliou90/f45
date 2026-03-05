import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActionCenterPrefs, getActionCenterQueue, saveActionCenterPrefs } from "../modules/action-center/api";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "test-rid" },
  });
}

describe("action center api", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    sessionStorage.clear();
  });

  it("loads and saves server-backed prefs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";

      if (url.includes("/api/v1/portal/prefs/action-center") && method === "GET") {
        return mockResponse({
          saved_views: [],
          default_view_id: null,
          team_queue_mode: "role_default",
          role_queue_overrides: {},
          updated_at: null,
        });
      }

      if (url.includes("/api/v1/portal/prefs/action-center") && method === "PUT") {
        return mockResponse({
          saved_views: [{ id: "view-1", name: "Morning Ops", query: "", modules: ["customers"], teams: [], updated_at: "2026-03-05T00:00:00Z" }],
          default_view_id: "view-1",
          team_queue_mode: "customers",
          role_queue_overrides: {},
          updated_at: "2026-03-05T00:00:00Z",
        });
      }

      return mockResponse({ ok: true });
    });

    vi.stubGlobal("fetch", fetchMock);

    const prefs = await getActionCenterPrefs();
    expect(prefs.teamQueueMode).toBe("role_default");

    const saved = await saveActionCenterPrefs({
      savedViews: [{ id: "view-1", name: "Morning Ops", query: "", modules: ["customers"], teams: [], updatedAt: "2026-03-05T00:00:00Z" }],
      defaultViewId: "view-1",
      teamQueueMode: "customers",
      roleQueueOverrides: {},
    });
    expect(saved.defaultViewId).toBe("view-1");
    expect(saved.savedViews[0].name).toBe("Morning Ops");
  });

  it("maps role-based queue snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/api/v1/portal/action-center/queue")) {
          return mockResponse({
            role: "ADMIN",
            team_mode: "hybrid",
            summary: {
              customer_tasks: 3,
              accounting_approvals: 2,
              accounting_exceptions: 1,
              accounting_reviews: 4,
            },
            items: [
              {
                id: "task:1",
                module: "customers",
                queue: "customer_tasks",
                title: "Casey Moon",
                detail: "Call customer",
                status: "open",
                priority: "high",
                due_at: "2026-03-05T00:00:00Z",
                owner: "",
                url: "/dms/customers/cust-1/overview",
              },
            ],
          });
        }
        return mockResponse({ ok: true });
      }),
    );

    const queue = await getActionCenterQueue("hybrid");
    expect(queue.teamMode).toBe("hybrid");
    expect(queue.summary.accountingApprovals).toBe(2);
    expect(queue.items[0].queue).toBe("customer_tasks");
  });
});
