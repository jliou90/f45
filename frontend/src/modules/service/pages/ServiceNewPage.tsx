import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { createServiceRecord } from "../api";

export function ServiceNewPage() {
  const navigate = useNavigate();
  const suggestedId = useMemo(() => `ro-${Date.now()}`, []);
  const [roId, setRoId] = useState(suggestedId);
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createServiceRecord({ roId, customerName, vehicle });
      navigate(`/dms/service/${created.id}`);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h1>New Service Record</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="stack">
        <label>
          RO ID
          <input value={roId} onChange={(event) => setRoId(event.target.value)} required />
        </label>
        <label>
          Customer Name
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        </label>
        <label>
          Vehicle
          <input value={vehicle} onChange={(event) => setVehicle(event.target.value)} />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Service Record"}
        </button>
      </form>
      {error ? <ErrorPanel error={error} title="Create failed" /> : null}
    </div>
  );
}
