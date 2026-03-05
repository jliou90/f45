import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomerProfile, emptyCustomerInput, listCustomerSummaries, updateCustomerProfile } from "../modules/customers/api";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "test-rid" },
  });
}

describe("customers api", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    sessionStorage.clear();
  });

  it("creates core customer and persists CRM profile", async () => {
    const customerId = "cust-1";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";

      if (url.includes("/api/v1/dms/customers") && method === "POST") {
        return mockResponse({
          id: customerId,
          tenant_id: "tenant-1",
          version: 1,
          first_name: "Ava",
          last_name: "Rivera",
          email: "ava@example.com",
          phone: "312-555-1000",
          address1: null,
          address2: null,
          city: null,
          state: null,
          zip: null,
        });
      }

      if (url.includes(`/api/v1/dms/customers/${customerId}/crm`) && method === "PUT") {
        return mockResponse({
          id: "crm-1",
          tenant_id: "tenant-1",
          customer_id: customerId,
          version: 1,
          dms_customer_id: "CUST-RIVE-20260305-ABCD",
          spouse: { first_name: "", last_name: "", phone: "", email: "", notes: "" },
          household: { household_id: "", relationship: "", linked_customer_ids: [] },
          phones: [],
          emails: [],
          garage: [],
          notes: [],
          communications: [],
        });
      }

      return mockResponse({ ok: true });
    });

    vi.stubGlobal("fetch", fetchMock);

    const input = emptyCustomerInput();
    input.firstName = "Ava";
    input.lastName = "Rivera";
    input.email = "ava@example.com";
    input.phone = "312-555-1000";
    input.dmsCustomerId = "CUST-RIVE-20260305-ABCD";

    const created = await createCustomerProfile(input);

    expect(created.id).toBe(customerId);
    expect(created.dmsCustomerId).toBe("CUST-RIVE-20260305-ABCD");

    const crmCall = fetchMock.mock.calls.find((call) => {
      const req = call[0];
      const url = typeof req === "string" ? req : req instanceof URL ? req.toString() : req.url;
      return url.includes(`/api/v1/dms/customers/${customerId}/crm`);
    });
    expect(crmCall).toBeTruthy();
    const crmInit = crmCall?.[1] as RequestInit;
    expect(crmInit.method).toBe("PUT");
    const headers = crmInit.headers as Record<string, string>;
    expect(headers["X-Tenant-Id"]).toBe("tenant-1");
  });

  it("updates customer and CRM profile with optimistic concurrency headers", async () => {
    const customerId = "cust-2";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";

      if (url.includes(`/api/v1/dms/customers/${customerId}`) && method === "PUT" && !url.endsWith("/crm")) {
        const headers = init?.headers as Record<string, string>;
        expect(headers["If-Match"]).toBe('"4"');
        return mockResponse({
          id: customerId,
          tenant_id: "tenant-1",
          version: 5,
          first_name: "Ava",
          last_name: "Rivera",
          email: "ava@updated.com",
          phone: "312-555-2000",
          address1: null,
          address2: null,
          city: null,
          state: null,
          zip: null,
        });
      }

      if (url.includes(`/api/v1/dms/customers/${customerId}/crm`) && method === "PUT") {
        const headers = init?.headers as Record<string, string>;
        expect(headers["If-Match"]).toBe('"2"');
        return mockResponse({
          id: "crm-2",
          tenant_id: "tenant-1",
          customer_id: customerId,
          version: 3,
          dms_customer_id: "CUST-RIVE-20260305-EFGH",
          spouse: { first_name: "", last_name: "", phone: "", email: "", notes: "" },
          household: { household_id: "", relationship: "", linked_customer_ids: [] },
          phones: [],
          emails: [],
          garage: [],
          notes: [],
          communications: [],
        });
      }

      return mockResponse({ ok: true });
    });

    vi.stubGlobal("fetch", fetchMock);

    const input = emptyCustomerInput();
    input.firstName = "Ava";
    input.lastName = "Rivera";
    input.email = "ava@updated.com";
    input.phone = "312-555-2000";
    input.dmsCustomerId = "CUST-RIVE-20260305-EFGH";

    const updated = await updateCustomerProfile(customerId, input, { customerVersion: 4, crmVersion: 2 });
    expect(updated.version).toBe(5);
    expect(updated.crmVersion).toBe(3);
    expect(updated.dmsCustomerId).toBe("CUST-RIVE-20260305-EFGH");
  });

  it("merges customer list with CRM list for summary rendering", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";

      if (url.includes("/api/v1/dms/customers/search?") && method === "GET") {
        return mockResponse({
          items: [
            {
              id: "cust-1",
              dms_customer_id: "CUST-DOE-20260305-ABCD",
              name: "Jane Doe",
              primary_phone: "312-555-9999",
              primary_email: "jane.crm@example.com",
              household_id: "HH-1",
              garage_count: 1,
              notes_count: 1,
              last_communication_at: "2026-03-05T01:00:00Z",
            },
          ],
          meta: { page: 1, size: 50, total: 1 },
        });
      }

      return mockResponse({ ok: true });
    });

    vi.stubGlobal("fetch", fetchMock);

    const rows = await listCustomerSummaries();
    expect(rows).toHaveLength(1);
    expect(rows[0].dmsCustomerId).toBe("CUST-DOE-20260305-ABCD");
    expect(rows[0].primaryPhone).toBe("312-555-9999");
    expect(rows[0].primaryEmail).toBe("jane.crm@example.com");
    expect(rows[0].householdId).toBe("HH-1");
  });

  it("finds records by CRM-only fields like DMS customer ID", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";

      if (url.includes("/api/v1/dms/customers/search?") && method === "GET") {
        return mockResponse({
          items: [
            {
              id: "cust-44",
              dms_customer_id: "CUST-STON-20260305-Z9X8",
              name: "Alex Stone",
              primary_phone: "312-555-4444",
              primary_email: "alex@example.com",
              household_id: "",
              garage_count: 0,
              notes_count: 0,
              last_communication_at: "",
            },
          ],
          meta: { page: 1, size: 50, total: 1 },
        });
      }

      return mockResponse({ ok: true });
    });

    vi.stubGlobal("fetch", fetchMock);

    const rows = await listCustomerSummaries("STON-20260305");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("cust-44");
    expect(rows[0].dmsCustomerId).toBe("CUST-STON-20260305-Z9X8");
  });
});
