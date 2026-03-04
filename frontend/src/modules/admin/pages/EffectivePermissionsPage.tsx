import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTenant } from "../../../app/use-tenant";
import { useAuth } from "../../../app/use-auth";
import { normalizePermissionId } from "../../../core/rbac/permissionCatalog";
import { resolveExplicitRolePermissions } from "../../../core/rbac/rolePermissions";
import { useQuery } from "../../../lib/query";
import { Button, Input, Select } from "../../../ui";
import { adminFeatureFlagEffective, adminGetRole, adminListUsers } from "../api";
import { computeEffectivePermissions, explainDecision } from "../rbac/effective";

export function EffectivePermissionsPage() {
  const auth = useAuth();
  const tenant = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get("user") ?? "");
  const [selectedTenantId, setSelectedTenantId] = useState(tenant.tenantId ?? "");
  const [testPermission, setTestPermission] = useState(searchParams.get("perm") ?? "admin.users.write");
  const groupFilter = searchParams.get("group") ?? "";
  const selectedRoleIdFromQuery = searchParams.get("role") ?? "";

  const usersQuery = useQuery(() => adminListUsers({ page: 1, size: 100, query: userQuery || undefined }), { deps: [userQuery] });

  const selectedUser = useMemo(() => {
    if (selectedUserId === "self") {
      return usersQuery.data?.items.find((item) => item.email === auth.user?.email) ?? null;
    }
    return usersQuery.data?.items.find((item) => item.id === selectedUserId) ?? null;
  }, [selectedUserId, usersQuery.data, auth.user?.email]);

  const selectedRoleId = selectedRoleIdFromQuery || selectedUser?.role_id || "";

  const roleDetailQuery = useQuery(
    () => (selectedRoleId ? adminGetRole(selectedRoleId) : Promise.resolve(null)),
    { deps: [selectedRoleId], enabled: Boolean(selectedRoleId), debugLabel: "admin_effective_role_detail" },
  );

  const featureFlagsQuery = useQuery(
    () => adminFeatureFlagEffective({ role_id: selectedRoleId || undefined }),
    { deps: [selectedRoleId], enabled: Boolean(selectedRoleId), debugLabel: "admin_effective_flags" },
  );

  const effective = useMemo(() => {
    if (!roleDetailQuery.data) {
      return computeEffectivePermissions({ directRoles: [] });
    }
    const resolved = resolveExplicitRolePermissions(roleDetailQuery.data.permissions, roleDetailQuery.data.name);
    return computeEffectivePermissions({
      directRoles: [
        {
          id: roleDetailQuery.data.id,
          name: roleDetailQuery.data.name,
          permissions: resolved.permissions,
        },
      ],
      featureGateByPermission: {
        "admin.audit.read": ["diagnosticsEnabled"],
      },
      enabledFeatureFlags: featureFlagsQuery.data?.flags,
    });
  }, [roleDetailQuery.data, featureFlagsQuery.data?.flags]);

  const filteredPermissions = useMemo(() => {
    const q = normalizePermissionId(testPermission);
    const groupPrefix = groupFilter ? `${normalizePermissionId(groupFilter)}.` : "";
    return effective.permissions.filter((item) => {
      if (groupPrefix && !item.startsWith(groupPrefix)) {
        return false;
      }
      if (!q) return true;
      return item.includes(q);
    });
  }, [effective.permissions, testPermission, groupFilter]);

  const decision = useMemo(() => explainDecision(testPermission, effective), [testPermission, effective]);

  const onUserSelect = (value: string) => {
    setSelectedUserId(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("user", value);
    else next.delete("user");
    next.delete("role");
    setSearchParams(next);
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Admin / Effective Permissions</div>
        <h1>Effective Permissions Inspector</h1>
        <p className="muted">Inspect what a user can do and why, with optional tenant context.</p>
      </div>

      <div className="panel stack">
        <label>
          Select user
          <Input
            type="search"
            placeholder="Search users by email or name"
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
          />
        </label>
        <Select value={selectedUserId} onChange={(event) => onUserSelect(event.target.value)}>
          <option value="">Choose user</option>
          {(usersQuery.data?.items ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.display_name || user.email} ({user.role_name || "no role"})
            </option>
          ))}
        </Select>

        <label>
          Tenant context (optional)
          <Select value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)}>
            <option value="">Current tenant</option>
            {tenant.tenants.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </label>
      </div>

      {selectedRoleId ? (
        <div className="panel stack">
          <h3>Effective roles</h3>
          <table className="dataTable">
            <thead>
              <tr>
                <th>Role</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {effective.roles.map((role) => (
                <tr key={`${role.source}:${role.id}`}>
                  <td>{role.name}</td>
                  <td>{role.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {roleDetailQuery.data ? (
            <p className="muted">
              Showing role <strong>{roleDetailQuery.data.name}</strong>.{" "}
              <Link to={`/admin/roles?focus=${encodeURIComponent(roleDetailQuery.data.id)}`}>Back to role editor</Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedRoleId ? (
        <div className="panel stack">
          <div className="sectionHeader">
            <h3>Effective permissions</h3>
            <Button type="button" variant="secondary" onClick={() => void roleDetailQuery.refetch()}>
              Refresh
            </Button>
          </div>
          <p className="muted">{filteredPermissions.length} permission(s) visible</p>
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Allowed</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((permission) => {
                  const explanation = effective.explanations[permission];
                  return (
                    <tr key={permission}>
                      <td><code>{permission}</code></td>
                      <td>{explanation?.allowed ? "Allowed" : "Denied"}</td>
                      <td>
                        {explanation?.sources.join(", ") || "No role source"}
                        {explanation?.impliedBy.length ? `; implied by ${explanation.impliedBy.join(", ")}` : ""}
                        {explanation?.missingPrerequisites.length ? `; missing ${explanation.missingPrerequisites.join(", ")}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {selectedRoleId ? (
        <div className="panel stack">
          <h3>Test an action</h3>
          <label>
            Permission key
            <Input value={testPermission} onChange={(event) => setTestPermission(event.target.value)} placeholder="admin.users.write" />
          </label>
          <div className="badge" style={{ width: "fit-content" }}>{decision.allowed ? "Allowed" : "Denied"}</div>
          <div className="stack">
            {decision.tree.map((item) => (
              <div key={item.label}>
                <strong>{item.label}:</strong> {item.value}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(usersQuery.isLoading || roleDetailQuery.isLoading || featureFlagsQuery.isLoading) ? (
        <div className="panel"><p className="muted">Loading inspector data...</p></div>
      ) : null}
    </div>
  );
}
