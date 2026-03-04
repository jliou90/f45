import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { appendServiceEvent, getServiceRecord } from "../api";
import { useQuery } from "../../../lib/query";

export function ServiceEditPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId || "";
  const query = useQuery(() => getServiceRecord(itemId), { enabled: Boolean(itemId), deps: [itemId] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const applyEvent = async (eventType: string) => {
    if (!itemId) return;
    setSaving(true);
    setError(null);
    try {
      await appendServiceEvent({ roId: itemId, eventType });
      await query.refetch();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h1>Service Edit</h1>
      <p className="muted">Apply workflow events to update service status.</p>
      {query.data ? (
        <>
          <p>
            Current status: <strong>{query.data.status}</strong>
          </p>
          <div className="row">
            <button type="button" disabled={saving} onClick={() => void applyEvent("ro.in_progress")}>
              Start Work
            </button>
            <button type="button" disabled={saving} onClick={() => void applyEvent("ro.completed")}>
              Mark Complete
            </button>
            <button type="button" disabled={saving} onClick={() => void applyEvent("ro.closed")}>
              Close RO
            </button>
          </div>
          <p>
            <Link to={`/dms/service/${itemId}`}>Back to detail</Link>
          </p>
        </>
      ) : (
        <p>Loading...</p>
      )}
      {query.error ? <ErrorPanel error={query.error} title="Record unavailable" /> : null}
      {error ? <ErrorPanel error={error} title="Update failed" /> : null}
    </div>
  );
}
