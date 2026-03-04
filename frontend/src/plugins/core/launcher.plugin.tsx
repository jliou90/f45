import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { LauncherPage } from "../../pages/LauncherPage";
import type { ModulePlugin } from "../types";

export const launcherPlugin: ModulePlugin = {
  id: "core.launcher",
  name: "Launcher",
  version: "1.0.0",
  description: "Portal home for favorites, recent apps, and quick actions.",
  keywords: ["launcher", "home", "portal"],
  routeBase: "/app",
  nav: {
    section: "DMS",
    label: "Launcher",
    order: 10,
  },
  routePolicy: "DMS",
  routes: () => (
    <>
      <Route
        path="/app"
        element={
          <ProtectedRoute route="DMS">
            <LauncherPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute route="DMS">
            <LauncherPage />
          </ProtectedRoute>
        }
      />
    </>
  ),
  launcherTiles: () => [
    {
      id: "home",
      name: "Launcher Home",
      description: "Portal home for favorites, recent apps, and quick actions.",
      to: "/app",
      keywords: ["home", "portal", "launcher"],
    },
  ],
};
