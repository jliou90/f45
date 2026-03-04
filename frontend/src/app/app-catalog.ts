import type { RoutePolicy } from "../lib/rbac";

export type LauncherApp = {
  id: string;
  name: string;
  description: string;
  to: string;
  route: RoutePolicy;
  keywords: string[];
  accessBadge?: string;
  devOnly?: boolean;
};

export const launcherApps: LauncherApp[] = [
  {
    id: "home",
    name: "Launcher Home",
    description: "Portal home for favorites, recent apps, and quick actions.",
    to: "/app",
    route: "DMS",
    keywords: ["home", "portal", "launcher"],
  },
  {
    id: "ops",
    name: "Ops Console",
    description: "Frontend/backend diagnostics and export.",
    to: "/admin/ops",
    route: "ADMIN_OPS",
    keywords: ["ops", "health", "diagnostics", "api"],
  },
  {
    id: "ops-outbox",
    name: "Outbox",
    description: "Offline write queue management and replay controls.",
    to: "/ops/outbox",
    route: "OPS_OUTBOX",
    keywords: ["ops", "outbox", "offline", "retry"],
  },
  {
    id: "tenants",
    name: "Tenants",
    description: "Select active dealership tenant and view memberships.",
    to: "/tenants",
    route: "TENANTS",
    keywords: ["tenant", "switch", "dealership"],
    accessBadge: "Admin/Manager",
  },
  {
    id: "dms-accounting",
    name: "Accounting",
    description: "Accounting periods and operational finance tasks.",
    to: "/acct/dashboard",
    route: "ACCOUNTING",
    keywords: ["dms", "accounting", "finance"],
  },
  {
    id: "dms-service",
    name: "Service",
    description: "Service events, writeups, and technician workflow.",
    to: "/service/dashboard",
    route: "SERVICE",
    keywords: ["dms", "service", "repair"],
  },
  {
    id: "dms-sales",
    name: "Sales",
    description: "Vehicle opportunities and sales workflow.",
    to: "/sales/dashboard",
    route: "SALES",
    keywords: ["dms", "sales", "crm"],
  },
  {
    id: "dms-comms",
    name: "Comms",
    description: "Quote approvals and conversation timelines.",
    to: "/comms/inbox",
    route: "COMMS",
    keywords: ["dms", "comms", "approval", "quotes"],
  },
  {
    id: "dms-reports",
    name: "Reports",
    description: "Library, scheduling, and export stubs.",
    to: "/reports/library",
    route: "REPORTS",
    keywords: ["dms", "reports", "export"],
  },
  {
    id: "dev-contracts",
    name: "Dev Contracts",
    description: "Developer contract validation against OpenAPI.",
    to: "/dev/contracts",
    route: "DEV_CONTRACTS",
    keywords: ["dev", "contracts", "openapi"],
    accessBadge: "Admin only",
    devOnly: true,
  },
];

export function routeLabel(pathname: string): string {
  const match = launcherApps.find((item) => item.to === pathname);
  return match ? match.name : pathname;
}
