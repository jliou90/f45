import type { ModulePlugin } from "../../plugins/types";
import { AccountingRoutes } from "./routes";

export const accountingPlugin: ModulePlugin = {
  id: "module.accounting",
  name: "Accounting",
  version: "1.0.0",
  description: "Accounting periods and finance workflow.",
  keywords: ["dms", "accounting", "finance"],
  routeBase: "/dms/accounting",
  nav: {
    section: "DMS",
    label: "Accounting",
    order: 210,
  },
  routePolicy: "ACCOUNTING",
  featureFlag: "accountingBeta",
  requiredRoutes: [{ path: "/api/v1/acct/periods", method: "GET" }],
  routes: () => AccountingRoutes(),
  launcherTiles: () => [
    {
      id: "dms-accounting",
      name: "Accounting",
      description: "Accounting periods and operational finance tasks.",
      to: "/dms/accounting",
      keywords: ["dms", "accounting", "finance"],
    },
  ],
};

