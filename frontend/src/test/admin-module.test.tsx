import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../app/App";
import { publishWindowSync } from "../lib/window-sync";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "admin-test-rid" },
  });
}

function setupFetch() {
  let effectiveCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

      if (url.includes("/api/v1/auth/me")) {
        return mockResponse({ id: "admin-1", email: "admin@example.com" });
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
      if (url.includes("/api/v1/admin/roles") && method === "GET") {
        if (url.includes("/api/v1/admin/roles/role-admin")) {
          return mockResponse({
            id: "role-admin",
            tenant_id: "tenant-1",
            name: "ADMIN",
            description: "Admin",
            permissions: ["admin.users.write", "admin.users.read", "admin.roles.read"],
            memberships_count: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        return mockResponse({
          items: [
            {
              id: "role-admin",
              name: "ADMIN",
              description: "Admin",
              permission_count: 6,
              memberships_count: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          meta: { page: 1, size: 100, total: 1 },
          request_id: "admin-test-rid",
        });
      }
      if (url.includes("/api/v1/admin/feature-flags/catalog") && method === "GET") {
        return mockResponse({
          items: [
            { key: "diagnostics.enabled", description: "Diagnostics", default_value: false },
          ],
          request_id: "admin-test-rid",
        });
      }
      if (url.includes("/api/v1/admin/feature-flags/overrides") && method === "GET") {
        return mockResponse({ tenant: [], role: [], user: [], request_id: "admin-test-rid" });
      }
      if (url.includes("/api/v1/admin/feature-flags/effective") && method === "GET") {
        effectiveCalls += 1;
        return mockResponse({ flags: { "diagnostics.enabled": true }, request_id: "admin-test-rid" });
      }
      if (url.includes("/api/v1/admin/feature-flags/overrides/") && method === "PUT") {
        return mockResponse({ ok: true, request_id: "admin-test-rid" });
      }
      if (url.includes("/api/v1/admin/users") && method === "GET") {
        return mockResponse({
          items: [
            {
              id: "user-2",
              email: "new.user@example.com",
              display_name: "New User",
              is_active: true,
              role_id: "role-admin",
              role_name: "ADMIN",
              membership_id: "membership-1",
              updated_at: new Date().toISOString(),
            },
          ],
          meta: { page: 1, size: 100, total: 1 },
          request_id: "admin-test-rid",
        });
      }
      if (url.includes("/api/v1/admin/users") && method === "POST") {
        return mockResponse({
          id: "user-3",
          email: "created@example.com",
          display_name: "Created User",
          is_active: true,
          role_id: "role-admin",
          role_name: "ADMIN",
          membership_id: "membership-3",
          membership_created_at: new Date().toISOString(),
          membership_updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          request_id: "admin-test-rid",
        });
      }
      return mockResponse({ ok: true });
    }),
  );
  return { getEffectiveCalls: () => effectiveCalls };
}

describe("admin module", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:access_token", "access");
    localStorage.setItem("kutm-shell:refresh_token", "refresh");
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    setupFetch();
  });

  it("shows Admin in navigation", async () => {
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Launcher/i });
    expect(screen.getAllByRole("link", { name: "Admin" }).length).toBeGreaterThan(0);
  });

  it("renders users list from API", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Users" });
    expect(await screen.findByText("new.user@example.com")).toBeInTheDocument();
  });

  it("validates create user form fields", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Users" });
    fireEvent.click(screen.getByRole("button", { name: "Invite User" }));

    const createButton = await screen.findByRole("button", { name: "Create Invite" });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "created@example.com" } });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "role-admin" } });
    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });
  });

  it("shows bulk safety warning when users are selected", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Users" });
    fireEvent.click(await screen.findByLabelText("Select new.user@example.com"));
    expect(await screen.findByText(/last admin-equivalent user/i)).toBeInTheDocument();
  });

  it("feature-flag broadcast triggers effective refetch", async () => {
    const fetchState = setupFetch();
    render(
      <MemoryRouter initialEntries={["/admin/feature-flags"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Feature Flags" });
    const initialCalls = fetchState.getEffectiveCalls();
    publishWindowSync({ type: "FEATURE_FLAGS_UPDATED", payload: { tenantId: "tenant-1" } });
    await waitFor(() => expect(fetchState.getEffectiveCalls()).toBeGreaterThan(initialCalls));
  });

  it("renders effective permissions inspector", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/permissions"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Effective Permissions Inspector" });
    expect(screen.getByText(/Inspect what a user can do and why/i)).toBeInTheDocument();
  });
});
