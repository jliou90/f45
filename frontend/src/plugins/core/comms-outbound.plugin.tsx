import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { CommsOutboundPage } from "../../modules/comms/pages/CommsOutboundPage";
import type { ModulePlugin } from "../types";

export const commsOutboundPlugin: ModulePlugin = {
  id: "core.comms-outbound",
  name: "Comms Outbound",
  version: "1.0.0",
  description: "Dedicated outbound communication tools for customer and lender messaging.",
  keywords: ["comms", "outbound", "customer email", "stip"],
  routeBase: "/dms/comms/outbound",
  nav: {
    section: "DMS",
    label: "Comms Outbound",
    order: 245,
  },
  routePolicy: "COMMS",
  featureFlag: "commsEnabled",
  routes: () => (
    <Route
      path="/dms/comms/outbound"
      element={
        <ProtectedRoute route="COMMS">
          <CommsOutboundPage />
        </ProtectedRoute>
      }
    />
  ),
  launcherTiles: () => [
    {
      id: "dms-comms-outbound",
      name: "Comms Outbound",
      description: "Send customer emails and lender stips.",
      to: "/dms/comms/outbound",
      keywords: ["comms", "outbound", "email", "stip"],
    },
  ],
};

