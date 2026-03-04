import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../app/auth-provider";
import { TenantProvider } from "../app/tenant-provider";
import { ProtectedRoute } from "../components/ProtectedRoute";

describe("ProtectedRoute", () => {
  it("redirects to /login when unauthenticated", async () => {
    localStorage.clear();

    render(
      <AuthProvider>
        <TenantProvider>
          <MemoryRouter initialEntries={["/ops"]}>
            <Routes>
              <Route path="/login" element={<div>Login Screen</div>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/ops" element={<div>Ops Screen</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </TenantProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText("Login Screen")).toBeInTheDocument();
  });
});
