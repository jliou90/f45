import { render, screen } from "@testing-library/react";
import { within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "../app/App";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "settings-test-rid" },
  });
}

function setupFetch(role: "ADMIN" | "USER") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/v1/auth/me")) {
        return mockResponse({ id: "u1", email: "user@example.com" });
      }
      if (url.includes("/api/v1/tenants/mine")) {
        return mockResponse({ items: [{ id: "tenant-1", name: "Main", role }] });
      }
      if (url.includes("/api/v1/tenants/current")) {
        return mockResponse({ id: "tenant-1", name: "Main", role });
      }
      if (url.includes("/readyz") || url.includes("/api/v1/ops/health")) {
        return mockResponse({ ok: true });
      }
      if (url.includes("/openapi.json")) {
        return mockResponse({ paths: {} });
      }
      if (url.includes("/api/v1/admin/users")) {
        if (role === "ADMIN") {
          return mockResponse({ items: [], meta: { page: 1, size: 100, total: 0 } });
        }
        return mockResponse({ detail: "forbidden" }, 403);
      }
      return mockResponse({ ok: true });
    }),
  );
}

describe("settings/admin top-level navigation", () => {
  it("shows Settings for authenticated user and hides Admin for non-admin role", async () => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:access_token", "access");
    localStorage.setItem("kutm-shell:refresh_token", "refresh");
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    setupFetch("USER");

    render(
      <MemoryRouter initialEntries={["/app"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Launcher/i });
    const sidebar = document.querySelector(".sidebar");
    expect(sidebar).not.toBeNull();
    const nav = within(sidebar as HTMLElement);
    expect(nav.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("blocks direct /admin route for non-admin role", async () => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:access_token", "access");
    localStorage.setItem("kutm-shell:refresh_token", "refresh");
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    setupFetch("USER");

    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Access Denied")).toBeInTheDocument();
  });
});
