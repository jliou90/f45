import { Link } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import { useQuery } from "../../../lib/query";
import { listConversations } from "../api";

export function CommsListPage() {
  const query = useQuery(() => listConversations());

  return (
    <div className="panel">
      <h1>Comms List</h1>
      <p className="muted">Legacy route maintained for compatibility; use `/dms/comms` for timeline workflow.</p>
      {query.data ? (
        <DataTable
          rows={query.data}
          columns={[
            { key: "id", header: "ID", render: (row) => <Link to={`/dms/comms/${row.id}`}>{row.id}</Link> },
            { key: "customerName", header: "Customer", render: (row) => row.customerName },
            { key: "status", header: "Status", render: (row) => row.status },
          ]}
        />
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
