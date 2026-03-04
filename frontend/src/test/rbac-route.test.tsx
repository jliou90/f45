import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../app/use-auth", () => ({
  useAuth: () => ({
    isInitializing: false,
    isAuthenticated: true,
  }),
}));

vi.mock("../app/use-tenant", () => ({
  useTenant: () => ({
    currentRole: "USER",
  }),
}));

import { ProtectedRoute } from "../components/ProtectedRoute";

describe("RBAC route guard", () => {
  it("blocks tenants page for USER role", () => {
    render(
      <MemoryRouter>
        <ProtectedRoute route="TENANTS">
          <div>Tenants Page Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.queryByText("Tenants Page Content")).not.toBeInTheDocument();
  });
});
