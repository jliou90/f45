import { Link } from "react-router-dom";
import { useState } from "react";
import { DataTable } from "../../../components/DataTable";
import { useQuery } from "../../../lib/query";
import { listServiceRecords, listTechnicianAvailability } from "../api";

export function ServiceListPage() {
  const [availabilityDay, setAvailabilityDay] = useState(() => new Date().toISOString().slice(0, 10));
  const query = useQuery(() => listServiceRecords());
  const availabilityQuery = useQuery(
    () => listTechnicianAvailability(availabilityDay),
    { deps: [availabilityDay], debugLabel: "service_technician_availability" },
  );
  return (
    <div className="stack">
      <div className="panel">
        <h1>Service List</h1>
        <p className="muted">Live queue view from `/api/v1/service/queue`.</p>
        <p>
          <Link to="/dms/service/new">Create</Link>
        </p>
        {query.data ? (
          <DataTable
            rows={query.data}
            columns={[
              { key: "id", header: "ID", render: (row) => <Link to={`/dms/service/${row.id}`}>{row.id}</Link> },
              { key: "title", header: "Title", render: (row) => row.title },
              { key: "status", header: "Status", render: (row) => row.status },
              {
                key: "updatedAt",
                header: "Updated",
                render: (row) => (row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "n/a"),
              },
            ]}
          />
        ) : (
          <p>Loading...</p>
        )}
      </div>
      <div className="panel">
        <h2>Technician Availability</h2>
        <p className="muted">From `/api/v1/dms/availability/technicians`.</p>
        <label>
          Day
          <input type="date" value={availabilityDay} onChange={(event) => setAvailabilityDay(event.target.value)} />
        </label>
        {availabilityQuery.data ? (
          <DataTable
            rows={availabilityQuery.data}
            columns={[
              { key: "userId", header: "User ID", render: (row) => row.userId },
              { key: "email", header: "Email", render: (row) => row.email },
              { key: "busyCount", header: "Busy Slots", render: (row) => row.busyCount },
              {
                key: "firstBusyStart",
                header: "First Busy Start",
                render: (row) => (row.firstBusyStart ? new Date(row.firstBusyStart).toLocaleString() : "Open"),
              },
            ]}
          />
        ) : (
          <p>Loading availability...</p>
        )}
      </div>
    </div>
  );
}
