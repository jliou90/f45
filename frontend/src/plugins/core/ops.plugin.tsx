import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { OpsPage } from "../../pages/OpsPage";
import type { ModulePlugin } from "../types";

export const opsPlugin: ModulePlugin = {
  id: "core.ops",
  name: "Ops",
  version: "1.0.0",
  description: "API health, version checks, and system diagnostics.",
  keywords: ["ops", "health", "diagnostics", "api"],
  routeBase: "/admin/ops",
  nav: {
    section: "OPS",
    label: "Ops Console",
    order: 110,
  },
  routePolicy: "ADMIN_OPS",
  featureFlag: "diagnosticsEnabled",
  requiredRoutes: [
    { path: "/api/v1/ops/health", method: "GET" },
    { path: "/api/v1/ops/version", method: "GET" },
    { path: "/api/v1/ops/feature-flags", method: "GET" },
    { path: "/api/v1/ops/status", method: "GET" },
    { path: "/api/v1/ops/logs/tail", method: "GET" },
  ],
  routes: () => (
    <Route
      path="/admin/ops"
      element={
        <ProtectedRoute route="ADMIN_OPS" requireTenant>
          <OpsPage />
        </ProtectedRoute>
      }
    />
  ),
  launcherTiles: () => [
    {
      id: "ops",
      name: "Ops Console",
      description: "Frontend/backend diagnostics, capture, and export.",
      to: "/admin/ops",
      keywords: ["ops", "health", "diagnostics", "api"],
    },
  ],
};
