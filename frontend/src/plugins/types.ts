import type { ReactElement } from "react";
import type { RoutePolicy } from "../lib/rbac";
import type { PluginContext } from "./context";

export type PluginRouteRequirement = {
  path: string;
  method: string;
};

export type LauncherTile = {
  id: string;
  name: string;
  description: string;
  to: string;
  keywords: string[];
  accessBadge?: string;
  devOnly?: boolean;
};

export type Command = {
  id: string;
  label: string;
  keywords: string[];
  run: () => void | Promise<void>;
};

export type PrintableDoc = {
  title: string;
  requestId?: string | null;
  sections: Array<{ label: string; value: string }>;
};

export type ModulePlugin = {
  id: string;
  name: string;
  version: string;
  description: string;
  keywords: string[];
  icon?: string;
  routeBase: string;
  nav: {
    section: "DMS" | "OPS" | "DEV" | string;
    label: string;
    order: number;
  };
  routePolicy: RoutePolicy;
  featureFlag?: string;
  requiredRoutes?: PluginRouteRequirement[];
  init?: (ctx: PluginContext) => Promise<void> | void;
  routes: () => ReactElement;
  launcherTiles?: () => LauncherTile[];
  commands?: (ctx: PluginContext) => Command[];
  realtime?: {
    topics: string[];
    onEvent: (event: unknown, ctx: PluginContext) => void;
  };
  print?: {
    templates: Array<{
      id: string;
      label: string;
      canPrint: (ctx: PluginContext) => boolean;
      render: (data: unknown, ctx: PluginContext) => PrintableDoc;
    }>;
  };
};
