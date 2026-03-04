import { useFeatureFlags } from "../app/use-feature-flags";
import { ErrorPanel } from "../components/ErrorPanel";
import { checkContractDrift, checkRequiredRoutes, REQUIRED_BASE_ROUTES } from "../lib/contracts";
import { API_BASE_ORIGIN } from "../lib/kutm";
import { getAllPluginRouteRequirements } from "../plugins/registry";
import { useQuery } from "../lib/query";

type PathMethods = Record<string, unknown>;
type OpenApiDoc = {
  paths?: Record<string, PathMethods>;
};

async function fetchOpenApi(): Promise<OpenApiDoc> {
  const response = await fetch(`${API_BASE_ORIGIN}/openapi.json`);
  if (!response.ok) {
    throw new Error(`OpenAPI fetch failed (${response.status})`);
  }
  return (await response.json()) as OpenApiDoc;
}

export function DevContractsPage() {
  const featureFlags = useFeatureFlags();
  const pluginRequirements = getAllPluginRouteRequirements({
    featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
    isDev: import.meta.env.DEV,
  });
  const query = useQuery(fetchOpenApi);
  const paths = query.data?.paths ?? {};
  const contractResult = query.data ? checkRequiredRoutes(query.data, pluginRequirements) : null;
  const driftResult = query.data ? checkContractDrift(query.data) : null;
  const dmsRoutes = Object.entries(paths).filter(([path]) => path.startsWith("/api/v1/dms/"));

  return (
    <div className="stack">
      <div className="panel">
        <h1>Dev Contracts</h1>
        <p className="muted">OpenAPI contract lock checks, required endpoint validation, and drift detection.</p>
      </div>

      <div className="panel">
        <h3>Required Endpoints</h3>
        {contractResult ? (
          <p>
            Result: <strong>{contractResult.ok ? "PASS" : "FAIL"}</strong> ({contractResult.present.length} present /{" "}
            {contractResult.missing.length} missing, generated endpoints: {contractResult.generatedCount})
          </p>
        ) : null}
        {query.isLoading ? <p>Loading /openapi.json...</p> : null}
        {!query.isLoading ? (
          <ul>
            {REQUIRED_BASE_ROUTES.map((route) => {
              const methodMap = paths[route.path] ?? {};
              const present = Boolean(methodMap[route.method.toLowerCase()]);
              return (
                <li key={`${route.path}:${route.method}`}>
                  <code>
                    {route.method.toUpperCase()} {route.path}
                  </code>{" "}
                  - <strong>{present ? "Present" : "Missing"}</strong>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="panel">
        <h3>Plugin Route Checks</h3>
        {pluginRequirements.length === 0 ? <p className="muted">No plugin requirements registered.</p> : null}
        {pluginRequirements.length > 0 ? (
          <ul>
            {pluginRequirements.map((route) => {
              const key = `${route.pluginId}:${route.method}:${route.path}`;
              const methodMap = paths[route.path] ?? {};
              const present = Boolean(methodMap[route.method.toLowerCase()]);
              return (
                <li key={key}>
                  <code>
                    [{route.pluginId}] {route.method} {route.path}
                  </code>{" "}
                  - <strong>{present ? "Present" : "Missing"}</strong>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="panel">
        <h3>Contract Drift</h3>
        {driftResult ? (
          <>
            <p>
              Missing in runtime: <strong>{driftResult.missingInRuntime.length}</strong> | Missing in generated: <strong>{" "}
              {driftResult.missingInGenerated.length}
            </strong>
            </p>
            <p className="muted">Use this to catch generated artifacts that do not match the running backend spec.</p>
          </>
        ) : null}
      </div>

      <div className="panel">
        <h3>Discovered DMS Endpoints</h3>
        {dmsRoutes.length === 0 ? <p>No /api/v1/dms/* routes found.</p> : null}
        {dmsRoutes.length > 0 ? (
          <ul>
            {dmsRoutes
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([path, methods]) => {
                const supportedMethods = Object.keys(methods).map((method) => method.toUpperCase());
                return (
                  <li key={path}>
                    <code>{path}</code> - {supportedMethods.join(", ")}
                  </li>
                );
              })}
          </ul>
        ) : null}
      </div>

      {query.error ? <ErrorPanel error={query.error} /> : null}
    </div>
  );
}

