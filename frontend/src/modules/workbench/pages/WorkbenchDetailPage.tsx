import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useToast } from "../../../app/use-toast";
import { deleteWorkbenchItem, discoverWorkbenchResource, getWorkbenchItem, type WorkbenchItem, type WorkbenchResource } from "../api";

export function WorkbenchDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const toast = useToast();
  const [item, setItem] = useState<WorkbenchItem | null>(null);
  const [resource, setResource] = useState<WorkbenchResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [selectedResource, detail] = await Promise.all([discoverWorkbenchResource(), getWorkbenchItem(itemId)]);
        if (cancelled) return;
        setResource(selectedResource);
        setItem(detail);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const onDelete = async () => {
    if (!itemId || !resource?.supportsDelete) return;
    try {
      const result = await deleteWorkbenchItem(itemId);
      toast.pushToast("success", `Deleted (request_id: ${result.request_id ?? "n/a"})`);
      window.location.assign("/dms/workbench");
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Delete failed");
    }
  };

  return (
    <div className="stack">
      <div className="panel">
        <h1>Workbench Detail</h1>
        {loading ? <p>Loading...</p> : null}
        {error ? <p>Failed: {error instanceof Error ? error.message : String(error)}</p> : null}
        {item ? (
          <>
            <pre>{JSON.stringify(item, null, 2)}</pre>
            <div className="row">
              <Link to={`/dms/workbench/${item.id}/edit`}>Edit</Link>
              {resource?.supportsDelete ? (
                <button type="button" className="dangerButton" onClick={() => void onDelete()}>
                  Delete
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

