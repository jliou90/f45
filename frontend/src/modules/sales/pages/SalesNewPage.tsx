import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { createSalesRecord } from "../api";

export function SalesNewPage() {
  const navigate = useNavigate();
  const suggestedId = useMemo(() => `deal-${Date.now()}`, []);
  const [dealId, setDealId] = useState(suggestedId);
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createSalesRecord({
        dealId,
        customerId,
        vehicleId,
        quoteAmountCents: Number.parseInt(quoteAmount || "0", 10) || 0,
      });
      navigate(`/dms/sales/${created.id}`);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h1>New Sales Deal</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="stack">
        <label>
          Deal ID
          <input value={dealId} onChange={(event) => setDealId(event.target.value)} required />
        </label>
        <label>
          Customer ID
          <input value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        </label>
        <label>
          Vehicle ID
          <input value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} />
        </label>
        <label>
          Quote Amount (cents)
          <input value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Sales Deal"}
        </button>
      </form>
      {error ? <ErrorPanel error={error} title="Create failed" /> : null}
    </div>
  );
}
