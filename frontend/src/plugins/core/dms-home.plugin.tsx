import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { DmsLandingPage } from "../../pages/DmsLandingPage";
import type { ModulePlugin } from "../types";

export const dmsHomePlugin: ModulePlugin = {
  id: "core.dms-home",
  name: "DMS Home",
  version: "1.0.0",
  description: "Landing page for DMS modules.",
  keywords: ["dms", "home", "landing"],
  routeBase: "/dms",
  nav: {
    section: "DMS",
    label: "DMS Home",
    order: 200,
  },
  routePolicy: "DMS",
  routes: () => (
    <Route
      path="/dms"
      element={
        <ProtectedRoute route="DMS">
          <DmsLandingPage />
        </ProtectedRoute>
      }
    />
  ),
};
