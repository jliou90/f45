import { Link, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import { getSalesRecord } from "../api";

export function SalesDetailPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId || "";
  const query = useQuery(() => getSalesRecord(itemId), { enabled: Boolean(itemId), deps: [itemId] });

  return (
    <div className="panel">
      <h1>Sales Detail</h1>
      {query.isLoading ? <p>Loading...</p> : null}
      {query.data ? (
        <>
          <p>
            <strong>ID:</strong> {query.data.id}
          </p>
          <p>
            <strong>Title:</strong> {query.data.title}
          </p>
          <p>
            <strong>State:</strong> {query.data.state}
          </p>
          <p>
            <strong>Updated:</strong> {query.data.updatedAt ? new Date(query.data.updatedAt).toLocaleString() : "n/a"}
          </p>
          <p>
            <Link to={`/dms/sales/${query.data.id}/edit`}>Edit</Link>
          </p>
        </>
      ) : null}
      {query.error ? <ErrorPanel error={query.error} title="Sales record unavailable" /> : null}
    </div>
  );
}
