import { Link } from "react-router-dom";
import { useFeatureFlags } from "../app/use-feature-flags";
import { useTenant } from "../app/use-tenant";
import { canAccess } from "../lib/rbac";
import { getLauncherTiles, getNavModel } from "../plugins/registry";

export function DmsLandingPage() {
  const featureFlags = useFeatureFlags();
  const tenant = useTenant();
  const isDev = import.meta.env.DEV;

  const navByPath = new Map(
    getNavModel({ featureFlags: featureFlags.flags as Record<string, boolean | string | number>, isDev }).map((item) => [item.to, item]),
  );
  const modules = getLauncherTiles({
    featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
    isDev,
  })
    .filter((item) => item.to.startsWith("/dms/"))
    .filter((item) => {
      const nav = navByPath.get(item.to);
      if (!nav) return true;
      return canAccess(nav.routePolicy, tenant.currentRole, isDev);
    });

  return (
    <div className="panel">
      <h1>DMS Modules</h1>
      <p className="muted">Choose a module area:</p>
      <ul>
        {modules.map((module) => (
          <li key={module.id}>
            <Link to={module.to}>{module.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

