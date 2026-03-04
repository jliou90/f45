import type { ModulePlugin } from "../../plugins/types";
import { ServiceRoutes } from "./routes";

export const servicePlugin: ModulePlugin = {
  id: "module.service",
  name: "Service",
  version: "1.0.0",
  description: "Service events and technician workflow.",
  keywords: ["dms", "service", "repair"],
  routeBase: "/dms/service",
  nav: {
    section: "DMS",
    label: "Service",
    order: 220,
  },
  routePolicy: "SERVICE",
  requiredRoutes: [{ path: "/api/v1/service/queue", method: "GET" }],
  routes: () => ServiceRoutes(),
  launcherTiles: () => [
    {
      id: "dms-service",
      name: "Service",
      description: "Service events, writeups, and technician workflow.",
      to: "/dms/service",
      keywords: ["dms", "service", "repair"],
    },
  ],
};

