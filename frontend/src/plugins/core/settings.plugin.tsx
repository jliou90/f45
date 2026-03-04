import type { ModulePlugin } from "../types";
import { settingsRoutes } from "../../modules/settings";

export const settingsPlugin: ModulePlugin = {
  id: "core.settings",
  name: "Settings",
  version: "1.0.0",
  description: "Personal profile, preferences, workspace, and sessions.",
  keywords: ["settings", "profile", "preferences", "workspace"],
  routeBase: "/settings",
  nav: {
    section: "OPS",
    label: "Settings",
    order: 106,
  },
  routePolicy: "DMS",
  routes: () => settingsRoutes(),
  launcherTiles: () => [
    {
      id: "settings",
      name: "Settings",
      description: "Manage your profile, preferences, and workspace defaults.",
      to: "/settings/profile",
      keywords: ["settings", "profile", "preferences", "workspace"],
    },
  ],
};
