import type { ModulePlugin } from "../../plugins/types";
import { WorkbenchRoutes } from "./routes";

export const workbenchPlugin: ModulePlugin = {
  id: "module.workbench",
  name: "Workbench",
  version: "1.0.0",
  description: "OpenAPI-discovered CRUD slice for DMS resources.",
  keywords: ["dms", "workbench", "appointments", "crud"],
  routeBase: "/dms/workbench",
  nav: {
    section: "DMS",
    label: "Workbench",
    order: 260,
  },
  routePolicy: "DMS",
  requiredRoutes: [
    { path: "/api/v1/dms/appointments", method: "GET" },
    { path: "/api/v1/dms/appointments", method: "POST" },
  ],
  routes: () => WorkbenchRoutes(),
  launcherTiles: () => [
    {
      id: "dms-workbench",
      name: "Workbench",
      description: "OpenAPI-discovered CRUD slice for DMS appointments.",
      to: "/dms/workbench",
      keywords: ["dms", "workbench", "appointments", "crud"],
    },
  ],
  realtime: {
    topics: ["workbench.updated"],
    onEvent: () => {
      // No-op for now.
    },
  },
};

export default workbenchPlugin;

