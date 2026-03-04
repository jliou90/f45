import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import { getSalesRecord, transitionSalesRecord } from "../api";

export function SalesEditPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId || "";
  const query = useQuery(() => getSalesRecord(itemId), { enabled: Boolean(itemId), deps: [itemId] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const transitionTo = async (toState: string) => {
    if (!itemId) return;
    setSaving(true);
    setError(null);
    try {
      await transitionSalesRecord({ dealId: itemId, toState, reason: `ui transition to ${toState}` });
      await query.refetch();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h1>Sales Edit</h1>
      <p className="muted">Apply deal state transitions.</p>
      {query.data ? (
        <>
          <p>
            Current state: <strong>{query.data.state}</strong>
          </p>
          <div className="row">
            <button type="button" disabled={saving} onClick={() => void transitionTo("penciled")}>
              Penciled
            </button>
            <button type="button" disabled={saving} onClick={() => void transitionTo("contracted")}>
              Contracted
            </button>
            <button type="button" disabled={saving} onClick={() => void transitionTo("delivered")}>
              Delivered
            </button>
          </div>
          <p>
            <Link to={`/dms/sales/${itemId}`}>Back to detail</Link>
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
