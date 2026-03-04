import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../app/use-auth";
import { useTenant } from "../app/use-tenant";
import { canAccess, type RoutePolicy } from "../lib/rbac";

type Props = {
  route?: RoutePolicy;
  requireTenant?: boolean;
  children?: ReactNode;
};

export function ProtectedRoute({ route, requireTenant = false, children }: Props) {
  const auth = useAuth();
  const tenant = useTenant();
  const location = useLocation();

  if (auth.isInitializing) {
    return <div className="panel">Initializing session...</div>;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (route && !canAccess(route, tenant.currentRole)) {
    return (
      <div className="panel">
        <h1>Access Denied</h1>
        <p className="muted">
          Role <strong>{tenant.currentRole ?? "UNKNOWN"}</strong> cannot access this route.
        </p>
      </div>
    );
  }

  if (requireTenant) {
    if (tenant.bootstrapState === "loading" || tenant.bootstrapState === "idle") {
      return (
        <div className="panel">
          <h1>Loading tenant...</h1>
          <p className="muted">Tenant context is still being prepared.</p>
        </div>
      );
    }
    if (!tenant.tenantId) {
      return <Navigate to="/tenant-picker" replace state={{ from: location.pathname }} />;
    }
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}

