import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "../app/App";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "settings-rbac-rid" },
  });
}

function setupFetch(settingsPermissions: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/v1/auth/me")) {
        return mockResponse({ id: "u1", email: "user@example.com" });
      }
      if (url.includes("/api/v1/tenants/mine")) {
        return mockResponse({ items: [{ id: "tenant-1", name: "Main", role: "USER" }] });
      }
      if (url.includes("/api/v1/tenants/current")) {
        return mockResponse({ id: "tenant-1", name: "Main", role: "USER" });
      }
      if (url.includes("/api/v1/rbac/permissions")) {
        return mockResponse({ items: settingsPermissions, meta: { page: 1, size: 500, total: settingsPermissions.length } });
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
}

describe("settings rbac enforcement", () => {
  it("renders preferences in read-only mode when write permission is missing", async () => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:access_token", "access");
    localStorage.setItem("kutm-shell:refresh_token", "refresh");
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    setupFetch(["settings.access", "settings.preferences.read"]);

    render(
      <MemoryRouter initialEntries={["/settings/preferences"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Preferences" });
    expect(await screen.findByText("Read-only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Preferences" })).toBeDisabled();
  });

  it("denies settings module when settings.access is missing", async () => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:access_token", "access");
    localStorage.setItem("kutm-shell:refresh_token", "refresh");
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    setupFetch(["settings.preferences.read", "settings.preferences.write"]);

    render(
      <MemoryRouter initialEntries={["/settings/preferences"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Access Denied")).toBeInTheDocument();
    expect(screen.getByText(/do not have permission to open Settings/i)).toBeInTheDocument();
  });
});
