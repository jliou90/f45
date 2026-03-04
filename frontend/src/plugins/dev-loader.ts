import type { ModulePlugin } from "./types";

type PluginModule = { default?: ModulePlugin; plugin?: ModulePlugin };

const devPluginModules = import.meta.env.DEV ? import.meta.glob<PluginModule>("./dev/*.plugin.tsx") : {};
const devPluginConfigFiles = import.meta.env.DEV ? import.meta.glob("./dev/*.json", { eager: true, query: "?raw", import: "default" }) : {};

function getConfiguredPluginIds(): Set<string> | null {
  const rawConfig = Object.values(devPluginConfigFiles)[0];
  if (typeof rawConfig !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(rawConfig) as { include?: string[] };
    if (!Array.isArray(parsed.include) || parsed.include.length === 0) {
      return null;
    }
    return new Set(parsed.include);
  } catch {
    return null;
  }
}

export async function loadDevPlugins(): Promise<ModulePlugin[]> {
  if (!import.meta.env.DEV) {
    return [];
  }

  const plugins: ModulePlugin[] = [];
  const includeIds = getConfiguredPluginIds();
  for (const loader of Object.values(devPluginModules)) {
    try {
      const mod = await loader();
      const plugin = mod.default ?? mod.plugin;
      if (plugin && (!includeIds || includeIds.has(plugin.id))) {
        plugins.push(plugin);
      }
    } catch {
      // Ignore broken dev plugins to keep shell bootable.
    }
  }
  return plugins;
}
