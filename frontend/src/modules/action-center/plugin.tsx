import type { ModulePlugin } from "../../plugins/types";
import { ActionCenterRoutes } from "./routes";

export const actionCenterPlugin: ModulePlugin = {
  id: "module.action-center",
  name: "Action Center",
  version: "1.0.0",
  description: "Cross-module execution hub for customer and accounting priorities.",
  keywords: ["dms", "action", "center", "customers", "accounting"],
  routeBase: "/dms/action-center",
  nav: {
    section: "DMS",
    label: "Action Center",
    order: 205,
  },
  routePolicy: "DMS",
  requiredRoutes: [{ path: "/api/v1/portal/search", method: "GET" }],
  routes: () => ActionCenterRoutes(),
  launcherTiles: () => [
    {
      id: "dms-action-center",
      name: "Action Center",
      description: "Single queue for customer tasks, accounting approvals, and cross-portal search.",
      to: "/dms/action-center",
      keywords: ["dms", "action", "queue", "customers", "accounting"],
    },
  ],
};
