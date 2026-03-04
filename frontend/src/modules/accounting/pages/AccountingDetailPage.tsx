import { Link, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import { getAccountingPeriod } from "../api";

export function AccountingDetailPage() {
  const params = useParams<{ periodId: string }>();
  const periodId = params.periodId ?? "";
  const query = useQuery(() => getAccountingPeriod(periodId), { enabled: Boolean(periodId), deps: [periodId] });

  return (
    <div className="stack">
      <div className="panel">
        <h1>Accounting Period Detail</h1>
        <p className="muted">Period ID: {periodId}</p>
        <p>
          <Link to={`/dms/accounting/${periodId}/edit`}>Edit</Link>
        </p>
      </div>
      <div className="panel">
        {query.isLoading ? <p>Loading period...</p> : null}
        {query.data ? <pre>{JSON.stringify(query.data, null, 2)}</pre> : null}
        {!query.isLoading && !query.data ? <p>Period not found in current list response.</p> : null}
        {query.error ? <ErrorPanel error={query.error} /> : null}
      </div>
    </div>
  );
}
