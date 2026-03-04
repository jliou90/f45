import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { TenantsPage } from "../../pages/TenantsPage";
import type { ModulePlugin } from "../types";

export const tenantsPlugin: ModulePlugin = {
  id: "core.tenants",
  name: "Tenants",
  version: "1.0.0",
  description: "Select active dealership tenant and view memberships.",
  keywords: ["tenant", "switch", "dealership"],
  routeBase: "/tenants",
  nav: {
    section: "OPS",
    label: "Tenants",
    order: 130,
  },
  routePolicy: "TENANTS",
  requiredRoutes: [
    { path: "/api/v1/tenants/mine", method: "GET" },
    { path: "/api/v1/tenants/current", method: "GET" },
  ],
  routes: () => (
    <Route
      path="/tenants"
      element={
        <ProtectedRoute route="TENANTS">
          <TenantsPage />
        </ProtectedRoute>
      }
    />
  ),
  launcherTiles: () => [
    {
      id: "tenants",
      name: "Tenants",
      description: "Select active dealership tenant and view memberships.",
      to: "/tenants",
      keywords: ["tenant", "switch", "dealership"],
      accessBadge: "Admin/Manager",
    },
  ],
};
