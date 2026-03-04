import type { RoutePolicy } from "../lib/rbac";

export type ModuleNavItem = {
  label: string;
  to: string;
  route: RoutePolicy;
  devOnly?: boolean;
};
