import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFeatureFlags } from "../../../app/use-feature-flags";
import { useToast } from "../../../app/use-toast";
import {
  addOrderBatchLine,
  createOrderBatch,
  createSupply,
  createWorkbenchItem,
  discoverWorkbenchResource,
  getDiscoveryMessage,
  listOrderBatches,
  listSupplies,
  listWorkbenchItems,
  type OrderBatch,
  type SupplyItem,
  type WorkbenchItem,
  type WorkbenchResource,
} from "../api";

const PAGE_SIZE = 10;

export function WorkbenchListPage() {
  const toast = useToast();
  const featureFlags = useFeatureFlags();
  const [items, setItems] = useState<WorkbenchItem[]>([]);
  const [resource, setResource] = useState<WorkbenchResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [vehicleVin, setVehicleVin] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [selectedResource, results] = await Promise.all([
        discoverWorkbenchResource(),
        listWorkbenchItems({ page, size: PAGE_SIZE, search }),
      ]);
      setResource(selectedResource);
      setItems(results);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadProcurement = useCallback(async () => {
    try {
      const [nextSupplies, nextBatches] = await Promise.all([listSupplies(true), listOrderBatches()]);
      setSupplies(nextSupplies);
      setBatches(nextBatches);
    } catch (nextError) {
      setError(nextError);
    }
  }, []);

  useEffect(() => {
    void loadProcurement();
  }, [loadProcurement]);

  const onCreate = async () => {
    if (customerName.trim().length < 2) {
      toast.pushToast("error", "Customer name must be at least 2 characters.");
      return;
    }
    if (vehicleVin.trim().length < 6) {
      toast.pushToast("error", "VIN must be at least 6 characters.");
      return;
    }

    try {
      const created = await createWorkbenchItem({
        customer_name: customerName.trim(),
        vehicle_vin: vehicleVin.trim(),
        status: "NEW",
      });
      setItems((current) => [created, ...current]);
      setOpenCreate(false);
      setCustomerName("");
      setVehicleVin("");
      toast.pushToast("success", `Created (request_id: ${created.request_id ?? "n/a"})`);
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Create failed");
    }
  };

  const discoveryMessage = getDiscoveryMessage();

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
      await loadProcurement();
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
      await loadProcurement();
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
      await loadProcurement();
    } catch (nextError) {
      setError(nextError);
      toast.pushToast("error", "Batch line update failed.");
    }
  };

  return (
    <div className="stack">
      <div className="panel">
        <h1>Workbench</h1>
        <p className="muted">OpenAPI-discovered DMS CRUD slice.</p>
        <p className="muted">Resource: {resource?.name ?? "(loading)"}</p>
        {discoveryMessage ? <p className="muted">Discovery fallback: {discoveryMessage}</p> : null}
        <div className="row">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search records"
            aria-label="Search workbench records"
          />
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
          <button type="button" onClick={() => setOpenCreate((value) => !value)}>
            {openCreate ? "Close" : "Create"}
          </button>
        </div>
        {openCreate ? (
          <div className="form" style={{ marginTop: "0.75rem" }}>
            <label>
              Customer name
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>
              Vehicle VIN
              <input value={vehicleVin} onChange={(event) => setVehicleVin(event.target.value)} />
            </label>
            <button type="button" onClick={() => void onCreate()}>
              Submit
            </button>
          </div>
        ) : null}
      </div>

      <div className="panel">
        {loading ? <p>Loading...</p> : null}
        {error ? <p>Failed: {error instanceof Error ? error.message : String(error)}</p> : null}
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/dms/workbench/${item.id}`}>{String(item.customer_name ?? item.id)}</Link> - {String(item.vehicle_vin ?? "(no vin)")} -{" "}
              {String(item.status ?? "UNKNOWN")}
            </li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
            Prev
          </button>
          <span className="muted">Page {page}</span>
          <button type="button" onClick={() => setPage((value) => value + 1)} disabled={items.length < PAGE_SIZE}>
            Next
          </button>
        </div>
      </div>

      {!featureFlags.flags.realtimeEnabled ? <p className="muted">Realtime disabled by feature flags.</p> : null}

      <div className="panel stack">
        <h2>Supplies & Procurement</h2>
        <p className="muted">Uses `/api/v1/inventory/supplies` and `/api/v1/inventory/order-batches`.</p>
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
      </div>
    </div>
  );
}

