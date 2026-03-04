import { ErrorPanel } from "../components/ErrorPanel";
import { kutmApi } from "../lib/kutm";
import { useQuery } from "../lib/query";

type Period = {
  id: string;
  status?: string | null;
};

type PeriodsPage = {
  items: Period[];
};

export function DmsAccountingPage() {
  const pingQuery = useQuery(
    () => kutmApi.get<PeriodsPage>("/acct/periods", { page: 1, size: 1 }, true),
    { enabled: true },
  );

  return (
    <div className="stack">
      <div className="panel">
        <h1>Accounting</h1>
        <p className="muted">Placeholder module with tenant-scoped ping.</p>
      </div>
      <div className="panel">
        <h3>Ping: GET /acct/periods?page=1&size=1</h3>
        {pingQuery.isLoading ? <p>Loading...</p> : null}
        {pingQuery.data ? <pre>{JSON.stringify(pingQuery.data, null, 2)}</pre> : null}
        {pingQuery.error ? <ErrorPanel error={pingQuery.error} /> : null}
      </div>
    </div>
  );
}
