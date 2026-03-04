import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFeatureFlags } from "../../../app/use-feature-flags";
import { useToast } from "../../../app/use-toast";
import {
  createWorkbenchItem,
  discoverWorkbenchResource,
  getDiscoveryMessage,
  listWorkbenchItems,
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
    </div>
  );
}

