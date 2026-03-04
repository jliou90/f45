import { useState } from "react";
import { ApiError } from "../../../lib/api";
import { useQuery } from "../../../lib/query";
import { Button, Input } from "../../../ui";
import { adminExportAudit, adminListAudit } from "../api";

function copyText(value: string | null | undefined) {
  if (!value) return;
  void navigator.clipboard.writeText(value);
}

function download(name: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminAuditPage() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const auditQuery = useQuery(
    () =>
      adminListAudit({
        page: 1,
        size: 100,
        actor: actor || undefined,
        action: action || undefined,
        ts_from: from || undefined,
        ts_to: to || undefined,
      }),
    { deps: [actor, action, from, to] },
  );

  const selected = auditQuery.data?.items.find((item) => item.id === selectedId) ?? null;

  const onExportJson = async () => {
    try {
      const payload = await adminExportAudit({ fmt: "json", ts_from: from || undefined, ts_to: to || undefined });
      download("admin-audit.json", JSON.stringify(payload, null, 2), "application/json");
    } catch (err) {
      setError(err as ApiError);
    }
  };

  const onExportCsv = async () => {
    try {
      const payload = await adminExportAudit({ fmt: "csv", ts_from: from || undefined, ts_to: to || undefined });
      download("admin-audit.csv", String(payload), "text/csv");
    } catch (err) {
      setError(err as ApiError);
    }
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="muted">Admin / Audit</div>
        <h1>Audit</h1>
        <div className="row">
          <Input placeholder="Actor id/email" value={actor} onChange={(event) => setActor(event.target.value)} />
          <Input placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} />
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <Button type="button" variant="secondary" onClick={() => void auditQuery.refetch()}>Refresh</Button>
          <Button type="button" variant="secondary" onClick={() => void onExportJson()}>Export JSON</Button>
          <Button type="button" variant="secondary" onClick={() => void onExportCsv()}>Export CSV</Button>
        </div>
      </div>

      {error ? <div className="panel"><p className="muted">{error.message} (request_id: {error.request_id ?? "n/a"})</p></div> : null}

      {auditQuery.isLoading ? <div className="panel">Loading audit events...</div> : null}

      {auditQuery.data ? (
        <div className="panel">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {auditQuery.data.items.map((event) => (
                <tr key={event.id} onClick={() => setSelectedId(event.id)}>
                  <td>{new Date(event.timestamp).toLocaleString()}</td>
                  <td>{event.actor_email || event.actor_user_id || "system"}</td>
                  <td>{event.action}</td>
                  <td>{event.target_type}:{event.target_id}</td>
                  <td>{event.request_id ? `request_id=${event.request_id}` : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="panel">
          <div className="sectionHeader">
            <h3>Event detail</h3>
            <Button type="button" variant="secondary" onClick={() => copyText(selected.request_id)}>
              Copy request id
            </Button>
          </div>
          <p className="muted">IP: {selected.actor_ip ?? "n/a"} | User-Agent: {selected.user_agent ?? "n/a"}</p>
          <pre>{JSON.stringify(selected.diff, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
