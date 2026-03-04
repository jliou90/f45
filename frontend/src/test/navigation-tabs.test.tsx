import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../app/App";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "test-rid" },
  });
}

describe("module navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:access_token", "access");
    localStorage.setItem("kutm-shell:refresh_token", "refresh");
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/api/v1/auth/me")) {
          return mockResponse({ id: "u1", email: "you@example.com" });
        }
        if (url.includes("/api/v1/tenants/mine")) {
          return mockResponse({ items: [{ id: "tenant-1", name: "Main", role: "ADMIN" }] });
        }
        if (url.includes("/api/v1/tenants/current")) {
          return mockResponse({ id: "tenant-1", name: "Main", role: "ADMIN" });
        }
        if (url.includes("/readyz") || url.includes("/api/v1/ops/health")) {
          return mockResponse({ ok: true });
        }
        if (url.includes("/openapi.json")) {
          return mockResponse({ paths: {} });
        }
        return mockResponse({ ok: true });
      }),
    );
  });

  it("allows switching DMS Home -> Accounting -> Comms", async () => {
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Launcher/i });
    const sidebar = document.querySelector(".sidebar");
    expect(sidebar).not.toBeNull();
    const nav = within(sidebar as HTMLElement);

    fireEvent.click(nav.getByRole("link", { name: "DMS Home" }));
    await screen.findByRole("heading", { name: "DMS Modules" });

    const accountingLink = nav.getByRole("link", { name: "Accounting" });
    fireEvent.click(accountingLink);
    await waitFor(() => {
      expect(accountingLink).toHaveAttribute("aria-current", "page");
    });

    const commsLink = nav.getByRole("link", { name: "Comms" });
    fireEvent.click(commsLink);
    await waitFor(() => {
      expect(commsLink).toHaveAttribute("aria-current", "page");
    });
  });
});
