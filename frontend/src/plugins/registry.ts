import type { ReactElement } from "react";
import type { PluginContext } from "./context";
import { loadDevPlugins } from "./dev-loader";
import type { Command, LauncherTile, ModulePlugin } from "./types";
import { corePlugins } from "./core";

export type PluginRegistryOptions = {
  featureFlags?: Record<string, boolean | string | number>;
  isDev?: boolean;
};

export type PluginNavItem = {
  pluginId: string;
  section: string;
  label: string;
  order: number;
  to: string;
  routePolicy: ModulePlugin["routePolicy"];
  featureFlag?: string;
};

let loadedPlugins: ModulePlugin[] = [...corePlugins];
let initialized = false;

function byKeyStable(a: ModulePlugin, b: ModulePlugin): number {
  const orderDiff = a.nav.order - b.nav.order;
  if (orderDiff !== 0) return orderDiff;
  return a.id.localeCompare(b.id);
}

function dedupePlugins(plugins: ModulePlugin[]): ModulePlugin[] {
  const seen = new Set<string>();
  const next: ModulePlugin[] = [];
  for (const plugin of plugins) {
    if (seen.has(plugin.id)) continue;
    seen.add(plugin.id);
    next.push(plugin);
  }
  return next.sort(byKeyStable);
}

function flagEnabled(plugin: ModulePlugin, flags: PluginRegistryOptions["featureFlags"]): boolean {
  if (!plugin.featureFlag) return true;
  const value = flags?.[plugin.featureFlag];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value !== "" && value !== "0" && value.toLowerCase() !== "false";
  return false;
}

function filterPlugins(plugins: ModulePlugin[], options?: PluginRegistryOptions): ModulePlugin[] {
  const isDev = options?.isDev ?? import.meta.env.DEV;
  const flags = options?.featureFlags;
  return plugins.filter((plugin) => {
    if (!isDev && plugin.nav.section === "DEV") {
      return false;
    }
    return flagEnabled(plugin, flags);
  });
}

export async function initPluginRegistry(ctx?: PluginContext): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;
  const devPlugins = await loadDevPlugins();
  loadedPlugins = dedupePlugins([...corePlugins, ...devPlugins]);
  if (!ctx) {
    return;
  }
  for (const plugin of loadedPlugins) {
    if (!plugin.init) continue;
    await plugin.init(ctx);
  }
}

export function getPlugins(options?: PluginRegistryOptions): ModulePlugin[] {
  return filterPlugins(loadedPlugins, options);
}

export function getNavModel(options?: PluginRegistryOptions): PluginNavItem[] {
  return getPlugins(options).map((plugin) => ({
    pluginId: plugin.id,
    section: plugin.nav.section,
    label: plugin.nav.label,
    order: plugin.nav.order,
    to: plugin.routeBase,
    routePolicy: plugin.routePolicy,
    featureFlag: plugin.featureFlag,
  }));
}

export function getRoutes(options?: PluginRegistryOptions): ReactElement[] {
  return getPlugins(options).map((plugin) => plugin.routes());
}

export function getLauncherTiles(options?: PluginRegistryOptions): LauncherTile[] {
  const byId = new Map<string, LauncherTile>();
  for (const plugin of getPlugins(options)) {
    const tiles = plugin.launcherTiles?.() ?? [];
    for (const tile of tiles) {
      if (!byId.has(tile.id)) {
        byId.set(tile.id, tile);
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPaletteCommands(ctx: PluginContext, options?: PluginRegistryOptions): Command[] {
  const byId = new Map<string, Command>();
  for (const plugin of getPlugins(options)) {
    const commands = plugin.commands?.(ctx) ?? [];
    for (const command of commands) {
      if (!byId.has(command.id)) {
        byId.set(command.id, command);
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function getAllPluginRouteRequirements(options?: PluginRegistryOptions): Array<{ pluginId: string; path: string; method: string }> {
  const routes: Array<{ pluginId: string; path: string; method: string }> = [];
  for (const plugin of getPlugins(options)) {
    for (const requirement of plugin.requiredRoutes ?? []) {
      routes.push({ pluginId: plugin.id, path: requirement.path, method: requirement.method.toUpperCase() });
    }
  }
  return routes;
}
