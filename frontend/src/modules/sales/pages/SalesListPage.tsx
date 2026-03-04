import { Link } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import { useQuery } from "../../../lib/query";
import { listSalesRecords } from "../api";

export function SalesListPage() {
  const query = useQuery(() => listSalesRecords());
  return (
    <div className="panel">
      <h1>Sales List</h1>
      <p className="muted">Live queue view from `/api/v1/deals/queue/by-state`.</p>
      <p>
        <Link to="/dms/sales/new">Create</Link>
      </p>
      {query.data ? (
        <DataTable
          rows={query.data}
          columns={[
            { key: "id", header: "ID", render: (row) => <Link to={`/dms/sales/${row.id}`}>{row.id}</Link> },
            { key: "title", header: "Title", render: (row) => row.title },
            { key: "state", header: "State", render: (row) => row.state },
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
