import { Link } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import { useQuery } from "../../../lib/query";
import { listServiceRecords } from "../api";

export function ServiceListPage() {
  const query = useQuery(() => listServiceRecords());
  return (
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
  );
}
