import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFeatureFlag } from "../../../app/use-feature-flag";
import { useTenant } from "../../../app/use-tenant";
import { getCatalogPermission, listPermissionsByGroup, normalizePermissionId, togglePermissionWithImplications } from "../../../core/rbac/permissionCatalog";
import { deleteMockRole, getMockRole, listMockRoles, mockRolePermissionsEnabled, upsertMockRole } from "../../../core/rbac/mockRolePermissions";
import { ROLE_TEMPLATES, applyRoleTemplate, settingsPermissionsForTemplate, type RoleTemplateKey } from "../../../core/rbac/roleTemplates";
import { ApiError } from "../../../lib/api";
import { hasPermission } from "../../../lib/rbac";
import { useQuery } from "../../../lib/query";
import { Button, EmptyState, Input, Modal } from "../../../ui";
import { adminCreateRole, adminDeleteRole, adminGetRole, adminListPermissions, adminListRoles, adminUpdateRole, type AdminRole } from "../api";

type RoleForm = {
  name: string;
  description: string;
  permissions: string[];
};

type PermissionRow = {
  id: string;
  label: string;
  description: string;
  groupKey: string;
  subgroupKey?: string;
  impliesRead: boolean;
};

type RoleListItem = AdminRole & { localOnly?: boolean };

const SETTINGS_PERMISSION_ROWS = listPermissionsByGroup("settings");
const WRITE_PERMISSIONS = SETTINGS_PERMISSION_ROWS.filter((item) => item.id.endsWith(".write")).map((item) => item.id);
const READ_PERMISSIONS = SETTINGS_PERMISSION_ROWS.filter((item) => item.id.endsWith(".read")).map((item) => item.id);
const SETTINGS_PERMISSION_IDS = SETTINGS_PERMISSION_ROWS.map((item) => item.id);

function toApiError(err: unknown): ApiError {
  return err as ApiError;
}

function supportsFallback(error: ApiError): boolean {
  return [404, 500, 501].includes(error.status);
}

function mergeRoleLists(remote: AdminRole[] | undefined, query: string): RoleListItem[] {
  const remoteItems = remote ?? [];
  const localItems = listMockRoles().map<RoleListItem>((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permission_count: role.permissions.length,
    memberships_count: 0,
    created_at: role.created_at,
    updated_at: role.updated_at,
    localOnly: true,
  }));
  const map = new Map<string, RoleListItem>();
  for (const item of remoteItems) {
    map.set(item.id, item);
  }
  for (const item of localItems) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  const normalizedQuery = query.trim().toLowerCase();
  return [...map.values()]
    .filter((item) => !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function permissionRows(keys: string[]): PermissionRow[] {
  return keys
    .map((key) => normalizePermissionId(key))
    .filter((key, index, list) => list.indexOf(key) === index)
    .map((id) => {
      const catalog = getCatalogPermission(id);
      return {
        id,
        label: catalog?.label ?? id,
        description: catalog?.description ?? "No catalog description available.",
        groupKey: catalog?.groupKey ?? (id.split(".")[0] ?? "misc"),
        subgroupKey: catalog?.subgroupKey,
        impliesRead: id.endsWith(".write"),
      };
    });
}

function subgroupLabel(subgroupKey: string): string {
  if (subgroupKey === "profile") return "Profile";
  if (subgroupKey === "preferences") return "Preferences";
  if (subgroupKey === "workspace") return "Workspace";
  if (subgroupKey === "notifications") return "Notifications";
  if (subgroupKey === "sessions") return "Sessions";
  if (subgroupKey === "access") return "Access";
  return subgroupKey;
}

function diffFromTemplate(templateKey: RoleTemplateKey | null, permissions: string[]): string[] {
  if (!templateKey) return [];
  const expected = new Set(settingsPermissionsForTemplate(templateKey));
  const actual = new Set(permissions.filter((permission) => permission.startsWith("settings.")));
  const diff = new Set<string>();
  for (const permission of expected) {
    if (!actual.has(permission)) diff.add(`Missing ${permission}`);
  }
  for (const permission of actual) {
    if (!expected.has(permission)) diff.add(`Extra ${permission}`);
  }
  return [...diff];
}

export function AdminRolesPage() {
  const tenant = useTenant();
  const canWrite = hasPermission("admin.roles.write", tenant.currentRole);
  const readOnly = Boolean(useFeatureFlag("admin.readOnly", false));
  const writesAllowed = canWrite && !readOnly;
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleForm>({ name: "", description: "", permissions: [] });
  const [error, setError] = useState<ApiError | null>(null);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [appliedTemplate, setAppliedTemplate] = useState<RoleTemplateKey | null>(null);
  const [focusedRoleIdHandled, setFocusedRoleIdHandled] = useState<string | null>(null);

  const rolesQuery = useQuery(() => adminListRoles({ page: 1, size: 100, query }), { deps: [query], debugLabel: "admin_roles_list" });
  const permissionsQuery = useQuery(() => adminListPermissions(), { deps: [], debugLabel: "admin_permissions_catalog" });

  const allPermissionRows = useMemo(() => {
    const backendKeys = (permissionsQuery.data?.items ?? []).map((permission) => permission.key);
    return permissionRows([...backendKeys, ...SETTINGS_PERMISSION_IDS]);
  }, [permissionsQuery.data]);

  const filteredPermissionRows = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();
    if (!q) return allPermissionRows;
    return allPermissionRows.filter((item) => item.id.includes(q) || item.label.toLowerCase().includes(q));
  }, [allPermissionRows, permissionSearch]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();
    for (const item of filteredPermissionRows) {
      const list = groups.get(item.groupKey) ?? [];
      list.push(item);
      groups.set(item.groupKey, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredPermissionRows]);

  const settingsSubgroups = useMemo(() => {
    const bySubgroup = new Map<string, PermissionRow[]>();
    const settingsRows = filteredPermissionRows.filter((item) => item.groupKey === "settings");
    for (const row of settingsRows) {
      const subgroup = row.subgroupKey ?? "other";
      const list = bySubgroup.get(subgroup) ?? [];
      list.push(row);
      bySubgroup.set(subgroup, list);
    }
    return [...bySubgroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredPermissionRows]);

  const visibleRoles = useMemo(() => mergeRoleLists(rolesQuery.data?.items, query), [rolesQuery.data?.items, query]);
  const templateDiff = useMemo(() => diffFromTemplate(appliedTemplate, form.permissions), [appliedTemplate, form.permissions]);
  const isDevMode = useMemo(() => import.meta.env.DEV || mockRolePermissionsEnabled(), []);

  useEffect(() => {
    const focusRoleId = searchParams.get("focus");
    if (!focusRoleId || focusRoleId === focusedRoleIdHandled) return;
    setFocusedRoleIdHandled(focusRoleId);
    void openEdit(focusRoleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, focusedRoleIdHandled]);

  const openCreate = () => {
    setEditingRoleId(null);
    setForm({ name: "", description: "", permissions: [] });
    setAppliedTemplate(null);
    setModalOpen(true);
    setError(null);
    setInlineMessage(null);
  };

  const openEdit = async (roleId: string) => {
    const local = getMockRole(roleId);
    if (local) {
      setEditingRoleId(roleId);
      setForm({ name: local.name, description: local.description ?? "", permissions: local.permissions });
      setModalOpen(true);
      setError(null);
      setInlineMessage("Editing local DEV role permissions.");
      return;
    }
    try {
      const detail = await adminGetRole(roleId);
      setEditingRoleId(roleId);
      setForm({ name: detail.name, description: detail.description ?? "", permissions: detail.permissions.map(normalizePermissionId) });
      setModalOpen(true);
      setError(null);
      setInlineMessage(null);
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const togglePermission = (key: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      permissions: togglePermissionWithImplications(prev.permissions, key, checked),
    }));
  };

  const grantAllSettingsRead = () => {
    setForm((prev) => ({
      ...prev,
      permissions: togglePermissionWithImplications([...prev.permissions, ...READ_PERMISSIONS], "settings.access", true),
    }));
  };

  const grantAllSettingsWrite = () => {
    const withWrites = WRITE_PERMISSIONS.reduce((acc, key) => togglePermissionWithImplications(acc, key, true), form.permissions);
    setForm((prev) => ({
      ...prev,
      permissions: togglePermissionWithImplications([...withWrites, "settings.access"], "settings.access", true),
    }));
  };

  const applyTemplateToForm = (templateKey: RoleTemplateKey) => {
    setForm((prev) => ({
      ...prev,
      name: editingRoleId ? prev.name : ROLE_TEMPLATES[templateKey].label,
      permissions: applyRoleTemplate(templateKey, prev.permissions),
    }));
    setAppliedTemplate(templateKey);
  };

  const onSave = async () => {
    setError(null);
    setInlineMessage(null);
    const normalizedForm = {
      ...form,
      permissions: form.permissions.map(normalizePermissionId),
    };
    try {
      if (editingRoleId && !editingRoleId.startsWith("local-role-")) {
        await adminUpdateRole(editingRoleId, normalizedForm);
      } else if (editingRoleId && editingRoleId.startsWith("local-role-")) {
        upsertMockRole({ id: editingRoleId, name: normalizedForm.name, description: normalizedForm.description, permissions: normalizedForm.permissions });
      } else {
        const created = await adminCreateRole(normalizedForm);
        setEditingRoleId(created.id);
      }
      setModalOpen(false);
      await rolesQuery.refetch();
    } catch (err) {
      const apiError = toApiError(err);
      if (supportsFallback(apiError) && mockRolePermissionsEnabled()) {
        const roleId = editingRoleId ?? `local-role-${Date.now()}`;
        upsertMockRole({ id: roleId, name: normalizedForm.name, description: normalizedForm.description, permissions: normalizedForm.permissions });
        setInlineMessage("Saved using DEV local role-permissions adapter (backend permissions endpoint unavailable).");
        setModalOpen(false);
        await rolesQuery.refetch();
        return;
      }
      setError(apiError);
    }
  };

  const onDelete = async (roleId: string) => {
    const role = visibleRoles.find((item) => item.id === roleId);
    if (!role) return;
    if (!window.confirm(`Delete role ${role.name}?`)) return;
    setError(null);
    try {
      if (role.localOnly) {
        deleteMockRole(roleId);
      } else {
        await adminDeleteRole(roleId, false);
      }
      await rolesQuery.refetch();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const permissionSelected = (id: string) => form.permissions.map(normalizePermissionId).includes(normalizePermissionId(id));

  return (
    <div className="stack">
      <div className="panel">
        <div className="sectionHeader">
          <div>
            <div className="muted">Admin / Roles</div>
            <h1>Roles</h1>
          </div>
          <Button type="button" onClick={openCreate} disabled={!writesAllowed}>
            Create Role
          </Button>
        </div>
        <Input type="search" placeholder="Search role name" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      {inlineMessage ? (
        <div className="panel">
          <p className="muted">{inlineMessage}</p>
        </div>
      ) : null}

      {error ? (
        <div className="panel">
          <p className="muted">{error.message}</p>
          <p className="muted">Request id: {error.request_id ?? "n/a"}</p>
          {(supportsFallback(error) || error.status >= 400) ? (
            <Button type="button" variant="secondary" onClick={() => void rolesQuery.refetch()}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {rolesQuery.isLoading ? <div className="panel">Loading roles...</div> : null}
      {!rolesQuery.isLoading && visibleRoles.length === 0 ? (
        <EmptyState title="No roles yet" description="Seed defaults or create your first role." />
      ) : null}

      {visibleRoles.length > 0 ? (
        <div className="panel">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Permissions</th>
                <th>Memberships</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name} {role.localOnly ? <span className="badge warn">DEV Local</span> : null}</td>
                  <td>{role.description || "n/a"}</td>
                  <td>{role.permission_count}</td>
                  <td>{role.memberships_count}</td>
                  <td>
                    <div className="row">
                      <Button type="button" variant="secondary" onClick={() => void openEdit(role.id)} disabled={!writesAllowed}>
                        Edit
                      </Button>
                      <Button type="button" variant="danger" onClick={() => void onDelete(role.id)} disabled={!writesAllowed}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal open={modalOpen} title={editingRoleId ? "Edit Role" : "Create Role"} onClose={() => setModalOpen(false)}>
        <div className="stack">
          <label>
            Name
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label>
            Description
            <Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </label>

          <div className="panel stack">
            <strong>Role Templates</strong>
            <div className="row">
              {(Object.keys(ROLE_TEMPLATES) as RoleTemplateKey[]).map((key) => (
                <button key={key} type="button" onClick={() => applyTemplateToForm(key)}>
                  {ROLE_TEMPLATES[key].label}
                </button>
              ))}
            </div>
            {appliedTemplate ? (
              <p className="muted">
                Template applied: <strong>{ROLE_TEMPLATES[appliedTemplate].label}</strong>.{" "}
                {templateDiff.length === 0 ? "No Settings diff." : `Diff from template: ${templateDiff.length} change(s).`}
              </p>
            ) : null}
          </div>

          <label>
            Search permissions
            <Input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="settings.preferences.write" />
          </label>

          <div className="panel stack">
            <div className="sectionHeader">
              <div>
                <strong>Settings (Self)</strong>
                <p className="muted">Controls what a user can do in /settings without granting Admin access.</p>
              </div>
              <div className="row">
                <Button type="button" variant="secondary" onClick={grantAllSettingsRead}>Grant all Settings Read</Button>
                <Button type="button" variant="secondary" onClick={grantAllSettingsWrite}>Grant all Settings Write</Button>
              </div>
            </div>
            {settingsSubgroups.map(([subgroup, rows]) => (
              <div key={subgroup} className="panel">
                <div className="muted">{subgroupLabel(subgroup)}</div>
                <div className="stack">
                  {rows.map((row) => (
                    <label key={row.id} className="stack" style={{ gap: "0.2rem" }}>
                      <span className="row">
                        <input
                          type="checkbox"
                          checked={permissionSelected(row.id)}
                          onChange={(event) => togglePermission(row.id, event.target.checked)}
                        />
                        <strong>{row.label}</strong>
                      </span>
                      <span className="muted">{row.description}</span>
                      <span className="muted"><code>{row.id}</code>{row.impliesRead ? " (write implies read)" : ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="stack">
            <strong>Other permissions</strong>
            {groupedPermissions
              .filter(([groupKey]) => groupKey !== "settings")
              .map(([groupKey, rows]) => (
                <div key={groupKey} className="panel">
                  <div className="muted">{groupKey}.*</div>
                  <div className="stack">
                    {rows.map((row) => (
                      <label key={row.id} className="row">
                        <input
                          type="checkbox"
                          checked={permissionSelected(row.id)}
                          onChange={(event) => togglePermission(row.id, event.target.checked)}
                        />
                        {row.id}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          <div className="row">
            <Button type="button" onClick={() => void onSave()} disabled={!form.name.trim() || !writesAllowed}>
              Save
            </Button>
            {editingRoleId ? (
              <Link className="linkButton" to={`/admin/permissions?role=${encodeURIComponent(editingRoleId)}&group=settings`}>
                View effective permissions for this role
              </Link>
            ) : null}
            {isDevMode ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(form.permissions.sort((a, b) => a.localeCompare(b)), null, 2))}
              >
                Copy permissions JSON
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}
