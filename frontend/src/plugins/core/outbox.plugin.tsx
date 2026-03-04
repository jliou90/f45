import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { OutboxPage } from "../../pages/OutboxPage";
import type { ModulePlugin } from "../types";

export const outboxPlugin: ModulePlugin = {
  id: "core.outbox",
  name: "Outbox",
  version: "1.0.0",
  description: "Offline write queue management and replay controls.",
  keywords: ["ops", "outbox", "offline", "retry"],
  routeBase: "/ops/outbox",
  nav: {
    section: "OPS",
    label: "Outbox",
    order: 120,
  },
  routePolicy: "OPS_OUTBOX",
  routes: () => (
    <Route
      path="/ops/outbox"
      element={
        <ProtectedRoute route="OPS_OUTBOX">
          <OutboxPage />
        </ProtectedRoute>
      }
    />
  ),
  launcherTiles: () => [
    {
      id: "ops-outbox",
      name: "Outbox",
      description: "Offline write queue management and replay controls.",
      to: "/ops/outbox",
      keywords: ["ops", "outbox", "offline", "retry"],
    },
  ],
};
