import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "../../../app/use-toast";
import { getWorkbenchItem, updateWorkbenchItem } from "../api";

export function WorkbenchEditPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const item = await getWorkbenchItem(itemId);
        if (cancelled) return;
        setStatus(String(item.status ?? ""));
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

  const onSave = async () => {
    if (!itemId) return;
    try {
      const updated = await updateWorkbenchItem(itemId, { status });
      toast.pushToast("success", `Updated (request_id: ${updated.request_id ?? "n/a"})`);
      navigate(`/dms/workbench/${itemId}`);
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Update failed");
    }
  };

  return (
    <div className="panel">
      <h1>Edit Workbench Item</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>Failed: {error instanceof Error ? error.message : String(error)}</p> : null}
      <label>
        Status
        <input value={status} onChange={(event) => setStatus(event.target.value)} />
      </label>
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <button type="button" onClick={() => void onSave()}>
          Save
        </button>
        <button type="button" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

