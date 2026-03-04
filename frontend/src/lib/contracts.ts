import { hasRoute, OPENAPI_ENDPOINTS } from "../gen/openapi-endpoints";

export type ContractRoute = {
  path: string;
  method: string;
};

type OpenApiDoc = {
  paths?: Record<string, Record<string, unknown>>;
};

export type PluginRouteRequirement = ContractRoute & {
  pluginId: string;
};

export type ContractsCheckResult = {
  ok: boolean;
  missing: ContractRoute[];
  present: ContractRoute[];
  generatedCount: number;
  pluginMissing: Record<string, ContractRoute[]>;
  pluginPresent: Record<string, ContractRoute[]>;
};

export type ContractDriftResult = {
  missingInRuntime: ContractRoute[];
  missingInGenerated: ContractRoute[];
};

export const REQUIRED_BASE_ROUTES: ContractRoute[] = [
  { path: "/api/v1/auth/login", method: "POST" },
  { path: "/api/v1/auth/me", method: "GET" },
  { path: "/api/v1/auth/refresh", method: "POST" },
  { path: "/api/v1/tenants/mine", method: "GET" },
  { path: "/api/v1/tenants/current", method: "GET" },
  { path: "/api/v1/ops/health", method: "GET" },
  { path: "/api/v1/ops/version", method: "GET" },
];

function endpointSetFromSpec(openapiJson: unknown): Set<string> {
  const doc = openapiJson as OpenApiDoc;
  const set = new Set<string>();
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const method of Object.keys(methods)) {
      set.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return set;
}

function dedupeRoutes(routes: ContractRoute[]): ContractRoute[] {
  const seen = new Set<string>();
  const output: ContractRoute[] = [];
  for (const route of routes) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ path: route.path, method: route.method.toUpperCase() });
  }
  return output;
}

export function checkRequiredRoutes(openapiJson: unknown, pluginRequirements: PluginRouteRequirement[] = []): ContractsCheckResult {
  const runtimeSet = endpointSetFromSpec(openapiJson);
  const missing: ContractRoute[] = [];
  const present: ContractRoute[] = [];
  const pluginMissing: Record<string, ContractRoute[]> = {};
  const pluginPresent: Record<string, ContractRoute[]> = {};

  const mergedRequired = dedupeRoutes([
    ...REQUIRED_BASE_ROUTES,
    ...pluginRequirements.map((item) => ({ path: item.path, method: item.method })),
  ]);

  for (const route of mergedRequired) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    const inRuntimeSpec = runtimeSet.has(key);
    const inGeneratedSpec = hasRoute(route.path, route.method);
    if (inRuntimeSpec && inGeneratedSpec) {
      present.push(route);
    } else {
      missing.push(route);
    }
  }

  for (const requirement of pluginRequirements) {
    const key = `${requirement.method.toUpperCase()} ${requirement.path}`;
    const inRuntimeSpec = runtimeSet.has(key);
    const inGeneratedSpec = hasRoute(requirement.path, requirement.method);
    const target = inRuntimeSpec && inGeneratedSpec ? pluginPresent : pluginMissing;
    target[requirement.pluginId] = target[requirement.pluginId] ?? [];
    target[requirement.pluginId].push({ path: requirement.path, method: requirement.method.toUpperCase() });
  }

  return {
    ok: missing.length === 0,
    missing,
    present,
    generatedCount: OPENAPI_ENDPOINTS.length,
    pluginMissing,
    pluginPresent,
  };
}

export function checkContractDrift(openapiJson: unknown): ContractDriftResult {
  const runtimeSet = endpointSetFromSpec(openapiJson);
  const generatedSet = new Set(OPENAPI_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`));

  const missingInRuntime = [...generatedSet]
    .filter((entry) => !runtimeSet.has(entry))
    .map((entry) => {
      const [method, path] = entry.split(" ");
      return { method, path };
    })
    .sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));

  const missingInGenerated = [...runtimeSet]
    .filter((entry) => !generatedSet.has(entry))
    .map((entry) => {
      const [method, path] = entry.split(" ");
      return { method, path };
    })
    .sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));

  return { missingInRuntime, missingInGenerated };
}
