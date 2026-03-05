import type { ModulePlugin } from "../../plugins/types";
import { CustomerRoutes } from "./routes";

export const customersPlugin: ModulePlugin = {
  id: "module.customers",
  name: "Customers",
  version: "1.0.0",
  description: "Customer CRM profiles, households, garage and communication history.",
  keywords: ["dms", "customers", "crm", "household", "communications"],
  routeBase: "/dms/customers",
  nav: {
    section: "DMS",
    label: "Customers",
    order: 235,
  },
  routePolicy: "CUSTOMERS",
  requiredRoutes: [{ path: "/api/v1/dms/customers", method: "GET" }],
  routes: () => CustomerRoutes(),
  launcherTiles: () => [
    {
      id: "dms-customers",
      name: "Customers",
      description: "CRM profiles with household, spouse, notes, and garage tracking.",
      to: "/dms/customers",
      keywords: ["dms", "customers", "crm", "household", "spouse"],
    },
  ],
};
