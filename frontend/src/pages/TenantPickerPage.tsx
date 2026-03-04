import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTenant } from "../app/use-tenant";
import { ErrorPanel } from "../components/ErrorPanel";

export function TenantPickerPage() {
  const tenant = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const target = (location.state as { from?: string } | null)?.from ?? "/app";

  useEffect(() => {
    if (tenant.bootstrapState === "idle") {
      void tenant.loadTenants();
      return;
    }

    if (tenant.bootstrapState === "ready" && tenant.tenantId) {
      navigate(target, { replace: true });
    }
  }, [tenant, navigate, target]);

  async function select(id: string) {
    const next = tenant.tenants.find((item) => item.id === id);
    if (!next) return;
    await tenant.selectTenant(next);
    navigate(target, { replace: true });
  }

  return (
    <div className="stack">
      <div className="panel">
        <h1>Tenant Picker</h1>
        <p className="muted">Select the dealership context for tenant-scoped modules.</p>
      </div>

      {tenant.bootstrapState === "loading" ? (
        <div className="panel">
          <p>Loading tenant...</p>
        </div>
      ) : null}

      {tenant.bootstrapState === "empty" ? (
        <div className="panel">
          <h3>No tenant memberships found</h3>
          <p className="muted">This account has no assigned tenant yet. Ask an administrator to grant membership.</p>
        </div>
      ) : null}

      {tenant.tenants.length > 0 ? (
        <div className="panel">
          <ul className="tenantList">
            {tenant.tenants.map((item) => (
              <li key={item.id} className={tenant.tenantId === item.id ? "selected" : ""}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">
                    {item.id} | role: {item.role}
                  </div>
                </div>
                <button type="button" onClick={() => void select(item.id)}>
                  Select
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tenant.bootstrapError ? <ErrorPanel error={new Error(tenant.bootstrapError)} title="Tenant load failed" /> : null}
    </div>
  );
}
