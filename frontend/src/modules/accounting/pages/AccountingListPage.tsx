import { Link } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { OPENAPI_ENDPOINTS } from "../../../gen/openapi-endpoints";
import { useQuery } from "../../../lib/query";
import { listAccountingPeriods } from "../api";

export function AccountingListPage() {
  const query = useQuery(() => listAccountingPeriods());
  const accountingPaths = OPENAPI_ENDPOINTS.filter((endpoint) => endpoint.path.startsWith("/api/v1/acct/")).slice(0, 40);

  return (
    <div className="stack">
      <div className="panel">
        <h1>Accounting Periods</h1>
        <p className="muted">Real module list screen using tenant-scoped GET /acct/periods.</p>
      </div>

      <div className="panel">
        <div className="row">
          <Link to="/dms/accounting/new">Create</Link>
        </div>
        {query.isLoading ? <p>Loading periods...</p> : null}
        {query.data ? (
          <DataTable
            rows={query.data}
            columns={[
              {
                key: "id",
                header: "Period ID",
                render: (row) => <Link to={`/dms/accounting/${row.id}`}>{row.id}</Link>,
              },
              { key: "status", header: "Status", render: (row) => row.status ?? "-" },
              { key: "year", header: "Year", render: (row) => row.year ?? "-" },
              { key: "month", header: "Month", render: (row) => row.month ?? "-" },
            ]}
          />
        ) : null}
        {query.error ? <ErrorPanel error={query.error} /> : null}
      </div>

      {import.meta.env.DEV ? (
        <div className="panel">
          <h3>Module API Explorer (/api/v1/acct/*)</h3>
          <ul>
            {accountingPaths.map((endpoint) => (
              <li key={`${endpoint.method}:${endpoint.path}`}>
                <code>
                  {endpoint.method} {endpoint.path}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
