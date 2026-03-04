import { useState } from "react";
import { useFeatureFlag } from "../../../app/use-feature-flag";
import { ApiError } from "../../../lib/api";
import { useQuery } from "../../../lib/query";
import { Button, EmptyState, Input } from "../../../ui";
import { adminListInvites, adminRevokeInvite } from "../api";

function copyText(value: string | null | undefined) {
  if (!value) return;
  void navigator.clipboard.writeText(value);
}

export function AdminInvitesPage() {
  const readOnly = Boolean(useFeatureFlag("admin.readOnly", false));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<ApiError | null>(null);

  const invitesQuery = useQuery(() => adminListInvites({ page: 1, size: 100, query }), { deps: [query] });

  const onRevoke = async (inviteId: string) => {
    if (!window.confirm("Revoke this invite?")) return;
    setError(null);
    try {
      await adminRevokeInvite(inviteId);
      await invitesQuery.refetch();
    } catch (err) {
      setError(err as ApiError);
    }
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Admin / Invites</div>
        <h1>Invites</h1>
        <Input type="search" placeholder="Search by email or role" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      {error ? (
        <div className="panel">
          <p className="muted">{error.message}</p>
          <p className="muted">Request id: {error.request_id ?? "n/a"}</p>
          <Button type="button" variant="secondary" onClick={() => copyText(error.request_id)}>Copy request id</Button>
        </div>
      ) : null}

      {invitesQuery.isLoading ? <div className="panel">Loading invites...</div> : null}

      {invitesQuery.data && invitesQuery.data.items.length === 0 ? (
        <EmptyState title="No invites" description="Create invites from Admin Users." />
      ) : null}

      {invitesQuery.data && invitesQuery.data.items.length > 0 ? (
        <div className="panel">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invitesQuery.data.items.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.email}</td>
                  <td>{invite.role_name ?? invite.role_id}</td>
                  <td>{invite.status}</td>
                  <td>{invite.created_by ?? "n/a"}</td>
                  <td>{new Date(invite.expires_at).toLocaleString()}</td>
                  <td>
                    <Button type="button" variant="danger" disabled={readOnly || invite.status !== "active"} onClick={() => void onRevoke(invite.id)}>
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
