import { Navigate, Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import type { ModulePlugin } from "../../plugins/types";
import { moduleDefinitions } from "./module-definitions";
import { ModulePage, ModuleShell } from "./module-scaffold";

export const scaffoldPlugins: ModulePlugin[] = moduleDefinitions.map((definition, index) => ({
  id: `module.${definition.id}`,
  name: definition.navLabel,
  version: "1.0.0",
  description: `${definition.navLabel} module scaffold`,
  keywords: [definition.id, definition.navLabel.toLowerCase(), "dms"],
  routeBase: definition.routeBase,
  nav: {
    section: "DMS",
    label: definition.navLabel,
    order: 300 + index,
  },
  routePolicy: definition.routePolicy,
  featureFlag: definition.featureFlag ?? "scaffoldEnabled",
  routes: () => (
    <Route
      path={definition.routeBase}
      element={
        <ProtectedRoute route={definition.routePolicy} requireTenant={definition.tenantScoped}>
          <ModuleShell module={definition} />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to={definition.pages[0].path} replace />} />
      {definition.pages.map((page) => (
        <Route key={`${definition.routeBase}/${page.path}`} path={page.path} element={<ModulePage module={definition} page={page} />} />
      ))}
    </Route>
  ),
  launcherTiles: () => [
    {
      id: `tile-${definition.id}`,
      name: definition.navLabel,
      description: `${definition.navLabel} module`,
      to: definition.routeBase,
      keywords: [definition.id, definition.navLabel.toLowerCase(), "module"],
    },
  ],
}));
