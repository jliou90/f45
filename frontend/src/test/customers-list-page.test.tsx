import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerListPage } from "../modules/customers/pages/CustomerListPage";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "test-rid" },
  });
}

describe("customer list page", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    sessionStorage.clear();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (url.includes("/api/v1/dms/customers/search?") && method === "GET") {
          return mockResponse({
            items: [
              {
                id: "cust-1",
                dms_customer_id: "CUST-PARK-20260305-ABCD",
                name: "Jamie Parker",
                primary_phone: "312-555-3434",
                primary_email: "crm-jamie@example.com",
                household_id: "HH-7",
                garage_count: 0,
                notes_count: 0,
                last_communication_at: "",
              },
            ],
            meta: { page: 1, size: 25, total: 1 },
          });
        }

        return mockResponse({ ok: true });
      }),
    );
  });

  it("renders merged customer summary fields after explicit search", async () => {
    render(
      <MemoryRouter>
        <CustomerListPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Customer CRM" });
    expect(screen.getByText("Enter a search and press `Search` (or Enter) to load results.")).toBeInTheDocument();

    const customerSearchInput = screen.getByLabelText("Search customers");
    const customerSearchForm = customerSearchInput.closest("form");
    if (!customerSearchForm) {
      throw new Error("Expected customer search form to exist");
    }
    fireEvent.click(within(customerSearchForm).getByRole("button", { name: "Search" }));

    expect(await screen.findByText("CUST-PARK-20260305-ABCD")).toBeInTheDocument();
    expect(await screen.findByText("Jamie Parker")).toBeInTheDocument();
    expect(await screen.findByText("312-555-3434")).toBeInTheDocument();
    expect(await screen.findByText("crm-jamie@example.com")).toBeInTheDocument();
    expect(await screen.findByText("HH-7")).toBeInTheDocument();
  });

  it("matches CRM-only terms (dmsCustomerId) in frontend search", async () => {
    render(
      <MemoryRouter>
        <CustomerListPage />
      </MemoryRouter>,
    );

    const search = await screen.findByLabelText("Search customers");
    fireEvent.change(search, { target: { value: "PARK-20260305-ABCD" } });
    const customerSearchForm = search.closest("form");
    if (!customerSearchForm) {
      throw new Error("Expected customer search form to exist");
    }
    fireEvent.click(within(customerSearchForm).getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Jamie Parker")).toBeInTheDocument();
  });
});
