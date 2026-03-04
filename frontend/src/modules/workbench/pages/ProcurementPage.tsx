import { useEffect, useState } from "react";
import { useToast } from "../../../app/use-toast";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { addOrderBatchLine, createOrderBatch, createSupply, listOrderBatches, listSupplies, type OrderBatch, type SupplyItem } from "../api";

export function ProcurementPage() {
  const toast = useToast();
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [batches, setBatches] = useState<OrderBatch[]>([]);
  const [supplySku, setSupplySku] = useState("");
  const [supplyName, setSupplyName] = useState("");
  const [supplyOnHand, setSupplyOnHand] = useState("0");
  const [supplyReorderPoint, setSupplyReorderPoint] = useState("0");
  const [supplyReorderQty, setSupplyReorderQty] = useState("0");
  const [batchName, setBatchName] = useState("");
  const [batchIdForLine, setBatchIdForLine] = useState("");
  const [supplyIdForLine, setSupplyIdForLine] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [error, setError] = useState<unknown>(null);

  const load = async () => {
    try {
      const [nextSupplies, nextBatches] = await Promise.all([listSupplies(true), listOrderBatches()]);
      setSupplies(nextSupplies);
      setBatches(nextBatches);
    } catch (nextError) {
      setError(nextError);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreateSupply = async () => {
    if (!supplySku.trim() || !supplyName.trim()) {
      toast.pushToast("error", "Supply SKU and name are required.");
      return;
    }
    try {
      await createSupply({
        sku: supplySku.trim(),
        name: supplyName.trim(),
        on_hand_qty: Number(supplyOnHand || 0),
        reorder_point: Number(supplyReorderPoint || 0),
        reorder_qty: Number(supplyReorderQty || 0),
      });
      setSupplySku("");
      setSupplyName("");
      toast.pushToast("success", "Supply created.");
      await load();
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Supply create failed.");
    }
  };

  const onCreateBatch = async () => {
    if (!batchName.trim()) {
      toast.pushToast("error", "Batch name is required.");
      return;
    }
    try {
      await createOrderBatch({ name: batchName.trim() });
      setBatchName("");
      toast.pushToast("success", "Order batch created.");
      await load();
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Batch create failed.");
    }
  };

  const onAddBatchLine = async () => {
    if (!batchIdForLine.trim() || !supplyIdForLine.trim()) {
      toast.pushToast("error", "Batch ID and Supply ID are required.");
      return;
    }
    try {
      await addOrderBatchLine({
        batchId: batchIdForLine.trim(),
        supplyItemId: supplyIdForLine.trim(),
        qty: Math.max(1, Number(lineQty || 1)),
      });
      toast.pushToast("success", "Batch line updated.");
      await load();
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Batch line update failed.");
    }
  };

  return (
    <div className="panel stack">
      <h1>Procurement</h1>
      <p className="muted">Dedicated inventory consumables and order-batch management.</p>
      <div className="row">
        <label>
          SKU
          <input value={supplySku} onChange={(event) => setSupplySku(event.target.value)} />
        </label>
        <label>
          Name
          <input value={supplyName} onChange={(event) => setSupplyName(event.target.value)} />
        </label>
        <label>
          On Hand
          <input type="number" value={supplyOnHand} onChange={(event) => setSupplyOnHand(event.target.value)} />
        </label>
        <label>
          Reorder Point
          <input type="number" value={supplyReorderPoint} onChange={(event) => setSupplyReorderPoint(event.target.value)} />
        </label>
        <label>
          Reorder Qty
          <input type="number" value={supplyReorderQty} onChange={(event) => setSupplyReorderQty(event.target.value)} />
        </label>
        <button type="button" onClick={() => void onCreateSupply()}>
          Add Supply
        </button>
      </div>
      <ul>
        {supplies.map((supply) => (
          <li key={supply.id}>
            {supply.sku} - {supply.name} (on hand {supply.on_hand_qty}, reorder {supply.reorder_point}/{supply.reorder_qty})
          </li>
        ))}
      </ul>
      <div className="row">
        <label>
          Batch Name
          <input value={batchName} onChange={(event) => setBatchName(event.target.value)} />
        </label>
        <button type="button" onClick={() => void onCreateBatch()}>
          Create Batch
        </button>
      </div>
      <div className="row">
        <label>
          Batch ID
          <input value={batchIdForLine} onChange={(event) => setBatchIdForLine(event.target.value)} />
        </label>
        <label>
          Supply ID
          <input value={supplyIdForLine} onChange={(event) => setSupplyIdForLine(event.target.value)} />
        </label>
        <label>
          Qty
          <input type="number" value={lineQty} onChange={(event) => setLineQty(event.target.value)} />
        </label>
        <button type="button" onClick={() => void onAddBatchLine()}>
          Add/Update Batch Line
        </button>
      </div>
      <ul>
        {batches.map((batch) => (
          <li key={batch.id}>
            {batch.name} ({batch.status}) - {batch.lines.length} lines
          </li>
        ))}
      </ul>
      {error ? <ErrorPanel error={error} title="Procurement unavailable" /> : null}
    </div>
  );
}

