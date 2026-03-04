import { Navigate, Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { DevContractsPage } from "../../pages/DevContractsPage";
import type { ModulePlugin } from "../types";

export const devContractsPlugin: ModulePlugin = {
  id: "core.dev-contracts",
  name: "Dev Contracts",
  version: "1.0.0",
  description: "Developer contract validation against OpenAPI.",
  keywords: ["dev", "contracts", "openapi"],
  routeBase: "/dev/contracts",
  nav: {
    section: "DEV",
    label: "Dev Contracts",
    order: 310,
  },
  routePolicy: "DEV_CONTRACTS",
  routes: () => (
    <Route
      path="/dev/contracts"
      element={
        <ProtectedRoute route="DEV_CONTRACTS">
          {import.meta.env.DEV ? <DevContractsPage /> : <Navigate to="/ops" replace />}
        </ProtectedRoute>
      }
    />
  ),
  launcherTiles: () => [
    {
      id: "dev-contracts",
      name: "Dev Contracts",
      description: "Developer contract validation against OpenAPI.",
      to: "/dev/contracts",
      keywords: ["dev", "contracts", "openapi"],
      accessBadge: "Admin only",
      devOnly: true,
    },
  ],
};
