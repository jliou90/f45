import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { ProcurementPage } from "../../modules/workbench/pages/ProcurementPage";
import type { ModulePlugin } from "../types";

export const procurementPlugin: ModulePlugin = {
  id: "core.procurement",
  name: "Procurement",
  version: "1.0.0",
  description: "Consumables inventory and order batch management.",
  keywords: ["inventory", "procurement", "supplies", "order batch"],
  routeBase: "/dms/procurement",
  nav: {
    section: "DMS",
    label: "Procurement",
    order: 265,
  },
  routePolicy: "INVENTORY",
  routes: () => (
    <Route
      path="/dms/procurement"
      element={
        <ProtectedRoute route="INVENTORY">
          <ProcurementPage />
        </ProtectedRoute>
      }
    />
  ),
  launcherTiles: () => [
    {
      id: "dms-procurement",
      name: "Procurement",
      description: "Manage supplies and purchase order batches.",
      to: "/dms/procurement",
      keywords: ["inventory", "procurement", "supplies", "orders"],
    },
  ],
};

