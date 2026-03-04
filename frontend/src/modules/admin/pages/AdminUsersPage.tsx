import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "../../../components/Drawer";
import { useAuth } from "../../../app/use-auth";
import { useFeatureFlag } from "../../../app/use-feature-flag";
import { useTenant } from "../../../app/use-tenant";
import { ApiError } from "../../../lib/api";
import { hasPermission } from "../../../lib/rbac";
import { useQuery } from "../../../lib/query";
import { useSearchParams } from "react-router-dom";
import { Button, EmptyState, Input, Modal, Select } from "../../../ui";
import { listMockRoles, mockRolePermissionsEnabled } from "../../../core/rbac/mockRolePermissions";
import {
  adminStartImpersonation,
  adminBulkUsers,
  adminCreateUser,
  adminChangeUserRole,
  adminCreateInvite,
  adminCreatePasswordReset,
  adminDisableUser,
  adminListRoles,
  adminListUserSessions,
  adminListUsers,
  adminRevokeAllSessions,
  adminRevokeSession,
  adminUpdateUser,
} from "../api";
import { startImpersonation, useImpersonationState } from "../state/impersonation";

function copyText(value: string | null | undefined) {
  if (!value) return;
  void navigator.clipboard.writeText(value);
}

function parseApiError(err: unknown): ApiError {
  return err as ApiError;
}

export function AdminUsersPage() {
  const auth = useAuth();
  const tenant = useTenant();
  const [searchParams] = useSearchParams();
  const canWrite = hasPermission("admin.users.write", tenant.currentRole);
  const canImpersonate = hasPermission("admin.users.impersonate", tenant.currentRole);
  const readOnly = Boolean(useFeatureFlag("admin.readOnly", false));
  const writesAllowed = canWrite && !readOnly;
  const impersonationState = useImpersonationState();

  const [query, setQuery] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [sessionsRevision, setSessionsRevision] = useState(0);
  const [inviteResult, setInviteResult] = useState<{ invite_id: string; invite_link?: string | null } | null>(null);
  const [addUserForm, setAddUserForm] = useState({ email: "", username: "", password: "", role_id: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", display_name: "", role_id: "", expires_in_days: 7 });
  const [editForm, setEditForm] = useState({ display_name: "", is_active: true, role_id: "" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"disable" | "set_role">("disable");
  const [bulkRoleId, setBulkRoleId] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [impersonateUserId, setImpersonateUserId] = useState<string | null>(null);
  const [impersonateConfirm, setImpersonateConfirm] = useState("");

  const usersQuery = useQuery(() => adminListUsers({ page: 1, size: 100, query }), { deps: [query] });
  const rolesQuery = useQuery(() => adminListRoles({ page: 1, size: 100 }), { deps: [] });
  const mergedRoles = useMemo(() => {
    const remote = rolesQuery.data?.items ?? [];
    if (!mockRolePermissionsEnabled()) return remote;
    const byId = new Map(remote.map((role) => [role.id, role]));
    for (const localRole of listMockRoles()) {
      if (!byId.has(localRole.id)) {
        byId.set(localRole.id, {
          id: localRole.id,
          name: localRole.name,
          description: localRole.description,
          permission_count: localRole.permissions.length,
          memberships_count: 0,
          created_at: localRole.created_at,
          updated_at: localRole.updated_at,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rolesQuery.data?.items]);
  const sessionsQuery = useQuery(
    () => (editUserId ? adminListUserSessions(editUserId, { page: 1, size: 100 }) : Promise.resolve({ items: [], meta: { page: 1, size: 100, total: 0 } })),
    { deps: [editUserId, sessionsRevision] },
  );

  const selectedUser = useMemo(() => {
    if (!editUserId || !usersQuery.data) return null;
    return usersQuery.data.items.find((user) => user.id === editUserId) ?? null;
  }, [editUserId, usersQuery.data]);

  const impersonateUser = useMemo(() => {
    if (!impersonateUserId || !usersQuery.data) return null;
    return usersQuery.data.items.find((user) => user.id === impersonateUserId) ?? null;
  }, [impersonateUserId, usersQuery.data]);

  const openEdit = useCallback((userId: string) => {
    const user = usersQuery.data?.items.find((item) => item.id === userId);
    if (!user) return;
    setEditForm({
      display_name: user.display_name ?? "",
      is_active: user.is_active,
      role_id: user.role_id ?? "",
    });
    setEditUserId(userId);
    setSessionsRevision((value) => value + 1);
    setInlineMessage(null);
    setError(null);
  }, [usersQuery.data]);

  useEffect(() => {
    const focusId = searchParams.get("focus");
    if (!focusId || !usersQuery.data) return;
    const match = usersQuery.data.items.find((item) => item.id === focusId);
    if (!match) return;
    queueMicrotask(() => {
      openEdit(match.id);
    });
  }, [openEdit, searchParams, usersQuery.data]);

  const toggleSelection = (userId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        return [...new Set([...prev, userId])];
      }
      return prev.filter((id) => id !== userId);
    });
  };

  const onInvite = async () => {
    setError(null);
    setInviteResult(null);
    try {
      const result = await adminCreateInvite(inviteForm);
      setInviteResult(result);
      await usersQuery.refetch();
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const onAddUser = async () => {
    setError(null);
    setInlineMessage(null);
    try {
      await adminCreateUser({
        email: addUserForm.email.trim(),
        display_name: addUserForm.username.trim() || undefined,
        password: addUserForm.password.trim() || undefined,
        role_id: addUserForm.role_id,
      });
      setAddUserOpen(false);
      setAddUserForm({ email: "", username: "", password: "", role_id: "" });
      setInlineMessage("User created.");
      await usersQuery.refetch();
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const onUpdateUser = async () => {
    if (!selectedUser) return;
    setError(null);
    setInlineMessage(null);
    try {
      const payload: { display_name?: string; is_active?: boolean } = {};
      payload.display_name = editForm.display_name;
      payload.is_active = editForm.is_active;
      await adminUpdateUser(selectedUser.id, payload);
      if (editForm.role_id && editForm.role_id !== selectedUser.role_id) {
        await adminChangeUserRole(selectedUser.id, editForm.role_id);
      }
      await usersQuery.refetch();
      setInlineMessage("User updated.");
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const onDisable = async (userId: string) => {
    if (!window.confirm("Disable this user? This can break access if they are the last admin.")) return;
    setError(null);
    try {
      await adminDisableUser(userId);
      await usersQuery.refetch();
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const onResetPassword = async () => {
    if (!selectedUser) return;
    setError(null);
    try {
      const result = await adminCreatePasswordReset(selectedUser.id);
      if (result.link) {
        setInlineMessage(`Password reset link generated. Request id: ${result.request_id ?? "n/a"}`);
      } else {
        setInlineMessage("Password reset initiated.");
      }
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const onRevokeAllSessions = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Revoke all sessions for this user?")) return;
    setError(null);
    try {
      await adminRevokeAllSessions(selectedUser.id);
      setSessionsRevision((value) => value + 1);
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const onRevokeSession = async (sessionId: string) => {
    setError(null);
    try {
      await adminRevokeSession(sessionId);
      setSessionsRevision((value) => value + 1);
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const onBulkRun = async () => {
    if (selectedIds.length === 0) return;
    const message = bulkAction === "disable"
      ? "Disable selected users? This will be blocked if it removes the last admin-equivalent user."
      : "Set role for selected users?";
    if (!window.confirm(message)) return;
    setError(null);
    try {
      const result = await adminBulkUsers({
        action: bulkAction,
        user_ids: selectedIds,
        role_id: bulkAction === "set_role" ? bulkRoleId : undefined,
      });
      setInlineMessage(`Bulk completed: ${result.successes.length} success, ${result.failures.length} failed.`);
      setSelectedIds([]);
      await usersQuery.refetch();
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const onImpersonate = async () => {
    if (!impersonateUser) return;
    if (impersonateConfirm.trim().toUpperCase() !== "IMPERSONATE") return;
    setError(null);
    setInlineMessage(null);
    try {
      if (!impersonationState.backendEnabled) {
        setInlineMessage("Backend support not enabled yet.");
        return;
      }
      await adminStartImpersonation(impersonateUser.id);
      startImpersonation(
        { id: auth.user?.id ?? "unknown", email: auth.user?.email ?? "unknown" },
        impersonateUser,
      );
      setInlineMessage(`Now impersonating ${impersonateUser.email}.`);
      setImpersonateUserId(null);
      setImpersonateConfirm("");
      await auth.loadMe();
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="sectionHeader">
          <div>
            <div className="muted">Admin / Users</div>
            <h1>Users</h1>
          </div>
          <div className="row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddUserOpen(true)}
              disabled={!writesAllowed}
              title={writesAllowed ? "Add user manually" : readOnly ? "Admin is read-only" : "Missing admin.users.write"}
            >
              Add User
            </Button>
            <Button
              type="button"
              onClick={() => setInviteOpen(true)}
              disabled={!writesAllowed}
              title={writesAllowed ? "Invite user" : readOnly ? "Admin is read-only" : "Missing admin.users.write"}
            >
              Invite User
            </Button>
          </div>
        </div>
        <Input
          type="search"
          placeholder="Search by name or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search users"
        />
      </div>

      {selectedIds.length > 0 ? (
        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{selectedIds.length} users selected</strong>
            <div className="row">
              <Select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "disable" | "set_role")}> 
                <option value="disable">Disable</option>
                <option value="set_role">Set role</option>
              </Select>
              {bulkAction === "set_role" ? (
                <Select value={bulkRoleId} onChange={(event) => setBulkRoleId(event.target.value)}>
                  <option value="">Select role</option>
                  {mergedRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </Select>
              ) : null}
              <Button type="button" onClick={() => void onBulkRun()} disabled={!writesAllowed || (bulkAction === "set_role" && !bulkRoleId)}>
                Run Bulk Action
              </Button>
            </div>
          </div>
          <p className="muted">Safety rail: bulk actions that would remove the last admin-equivalent user are blocked by backend validation.</p>
        </div>
      ) : null}

      {error ? (
        <div className="panel">
          <p className="muted">Error: {error.message}</p>
          <p className="muted">Request id: {error.request_id ?? "n/a"}</p>
          <Button type="button" variant="secondary" onClick={() => copyText(error.request_id)}>
            Copy request id
          </Button>
        </div>
      ) : null}

      {inlineMessage ? <div className="panel"><p className="muted">{inlineMessage}</p></div> : null}

      {usersQuery.isLoading ? <div className="panel">Loading users...</div> : null}
      {usersQuery.isError ? (
        <div className="panel">
          <p className="muted">Failed to load users.</p>
          <Button type="button" variant="secondary" onClick={() => void usersQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {usersQuery.data && usersQuery.data.items.length === 0 ? (
        <EmptyState title="No users yet" description="Invite your first tenant user to get started." />
      ) : null}

      {usersQuery.data && usersQuery.data.items.length > 0 ? (
        <div className="panel">
          <table className="dataTable">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.items.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      aria-label={`Select ${user.email}`}
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={(event) => toggleSelection(user.id, event.target.checked)}
                    />
                  </td>
                  <td>{user.display_name || "n/a"}</td>
                  <td>{user.email}</td>
                  <td>{user.role_name || "n/a"}</td>
                  <td>{user.is_active ? "Active" : "Disabled"}</td>
                  <td>{new Date(user.updated_at).toLocaleString()}</td>
                  <td>
                    <div className="row">
                      <Button type="button" variant="secondary" onClick={() => openEdit(user.id)} disabled={!writesAllowed}>
                        Edit
                      </Button>
                      <Button type="button" variant="danger" onClick={() => void onDisable(user.id)} disabled={!writesAllowed || !user.is_active}>
                        Disable
                      </Button>
                      {canImpersonate ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setImpersonateUserId(user.id)}
                          disabled={!impersonationState.backendEnabled}
                          title={impersonationState.backendEnabled ? "Impersonate this user" : "Backend support not enabled yet"}
                        >
                          Impersonate
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal open={addUserOpen} title="Add User" onClose={() => setAddUserOpen(false)}>
        <div className="stack">
          <label>
            Username
            <Input
              value={addUserForm.username}
              onChange={(event) => setAddUserForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="Display name"
            />
          </label>
          <label>
            Email
            <Input
              type="email"
              value={addUserForm.email}
              onChange={(event) => setAddUserForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="user@example.com"
            />
          </label>
          <label>
            Password
            <Input
              type="password"
              value={addUserForm.password}
              onChange={(event) => setAddUserForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Minimum 8 characters"
            />
          </label>
          <label>
            Access
            <Select
              value={addUserForm.role_id}
              onChange={(event) => setAddUserForm((prev) => ({ ...prev, role_id: event.target.value }))}
            >
              <option value="">Select role</option>
              {mergedRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="button"
            onClick={() => void onAddUser()}
            disabled={!writesAllowed || !addUserForm.email.trim() || !addUserForm.role_id || addUserForm.password.trim().length < 8}
          >
            Create User
          </Button>
        </div>
      </Modal>

      <Modal open={inviteOpen} title="Invite User" onClose={() => setInviteOpen(false)}>
        <div className="stack">
          <label>
            Email
            <Input
              type="email"
              value={inviteForm.email}
              onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label>
            Display name
            <Input
              value={inviteForm.display_name}
              onChange={(event) => setInviteForm((prev) => ({ ...prev, display_name: event.target.value }))}
            />
          </label>
          <label>
            Role
            <Select
              value={inviteForm.role_id}
              onChange={(event) => setInviteForm((prev) => ({ ...prev, role_id: event.target.value }))}
            >
              <option value="">Select role</option>
              {mergedRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </label>
          <Button type="button" onClick={() => void onInvite()} disabled={!inviteForm.email || !inviteForm.role_id || !writesAllowed}>
            Create Invite
          </Button>
          {inviteResult ? (
            <div className="panel">
              <p className="muted">Invite created: {inviteResult.invite_id}</p>
              {inviteResult.invite_link ? (
                <div className="row">
                  <Input value={inviteResult.invite_link} readOnly />
                  <Button type="button" variant="secondary" onClick={() => copyText(inviteResult.invite_link)}>
                    Copy invite link
                  </Button>
                </div>
              ) : (
                <p className="muted">Invite created (link hidden in this environment).</p>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal open={Boolean(impersonateUserId)} title="Confirm Impersonation" onClose={() => setImpersonateUserId(null)}>
        {impersonateUser ? (
          <div className="stack">
            <p>You are about to impersonate <strong>{impersonateUser.email}</strong>. This will switch your session context.</p>
            <p className="muted">Type <code>IMPERSONATE</code> to confirm.</p>
            <Input value={impersonateConfirm} onChange={(event) => setImpersonateConfirm(event.target.value)} placeholder="IMPERSONATE" />
            <Button
              type="button"
              onClick={() => void onImpersonate()}
              disabled={!impersonationState.backendEnabled || impersonateConfirm.trim().toUpperCase() !== "IMPERSONATE"}
              title={impersonationState.backendEnabled ? "Confirm impersonation" : "Backend support not enabled yet"}
            >
              Confirm Impersonate
            </Button>
          </div>
        ) : null}
      </Modal>

      <Drawer open={Boolean(editUserId)} title="Edit User" onClose={() => setEditUserId(null)}>
        {selectedUser ? (
          <div className="stack">
            <label>
              Display name
              <Input
                value={editForm.display_name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, display_name: event.target.value }))}
              />
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(event) => setEditForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Active
            </label>
            <label>
              Role
              <Select
                value={editForm.role_id}
                onChange={(event) => setEditForm((prev) => ({ ...prev, role_id: event.target.value }))}
              >
                <option value="">Select role</option>
                {mergedRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="row">
              <Button type="button" onClick={() => void onUpdateUser()} disabled={!writesAllowed}>Save</Button>
              <Button type="button" variant="secondary" onClick={() => void onResetPassword()} disabled={!writesAllowed}>
                Reset Password
              </Button>
            </div>

            <div className="panel">
              <div className="sectionHeader">
                <strong>Sessions</strong>
                <Button type="button" variant="danger" onClick={() => void onRevokeAllSessions()} disabled={!writesAllowed}>
                  Revoke All Sessions
                </Button>
              </div>
              {sessionsQuery.data?.items?.length ? (
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Created</th>
                      <th>Last Seen</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(sessionsQuery.data?.items ?? []).map((session) => (
                      <tr key={session.session_id}>
                        <td>{session.session_id.slice(0, 8)}...</td>
                        <td>{new Date(session.created_at).toLocaleString()}</td>
                        <td>{session.last_seen_at ? new Date(session.last_seen_at).toLocaleString() : "n/a"}</td>
                        <td>{session.is_active ? "Active" : "Revoked/Expired"}</td>
                        <td>
                          <Button type="button" variant="secondary" onClick={() => void onRevokeSession(session.session_id)} disabled={!writesAllowed}>
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No sessions found.</p>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
