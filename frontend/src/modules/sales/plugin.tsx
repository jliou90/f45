import type { ModulePlugin } from "../../plugins/types";
import { SalesRoutes } from "./routes";

export const salesPlugin: ModulePlugin = {
  id: "module.sales",
  name: "Sales",
  version: "1.0.0",
  description: "Vehicle opportunities and sales workflow.",
  keywords: ["dms", "sales", "crm"],
  routeBase: "/dms/sales",
  nav: {
    section: "DMS",
    label: "Sales",
    order: 230,
  },
  routePolicy: "SALES",
  requiredRoutes: [{ path: "/api/v1/deals/queue/by-state", method: "GET" }],
  routes: () => SalesRoutes(),
  launcherTiles: () => [
    {
      id: "dms-sales",
      name: "Sales",
      description: "Vehicle opportunities and sales workflow.",
      to: "/dms/sales",
      keywords: ["dms", "sales", "crm"],
    },
  ],
};

