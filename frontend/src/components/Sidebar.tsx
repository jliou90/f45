import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useFeatureFlags } from "../app/use-feature-flags";
import { useTenant } from "../app/use-tenant";
import { getTenantBranding } from "../lib/branding";
import { canAccess } from "../lib/rbac";
import { getNavModel } from "../plugins/registry";

const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "navLink active" : "navLink");

export function Sidebar() {
  const tenant = useTenant();
  const featureFlags = useFeatureFlags();
  const isDev = import.meta.env.DEV;
  const role = tenant.currentRole;
  const branding = getTenantBranding(tenant.tenantId);

  const navItems = useMemo(
    () =>
      getNavModel({
        featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
        isDev,
      }).filter((item) => canAccess(item.routePolicy, role, isDev)),
    [featureFlags.flags, isDev, role],
  );
  return (
    <aside className="sidebar">
      <h2 className="sidebarBrand">
        {branding.logoUrl ? <img src={branding.logoUrl} alt={`${branding.brandName} logo`} className="sidebarLogo" /> : null}
        <span>{branding.brandName}</span>
      </h2>
      <nav>
        {navItems.map((item) => (
          <NavLink
            key={item.pluginId}
            to={item.to}
            className={navLinkClass}
            end={item.to === "/app"}
          >
            {item.label}
          </NavLink>
        ))}
        <NavLink to="/system" className={navLinkClass}>
          System
        </NavLink>
      </nav>
    </aside>
  );
}

