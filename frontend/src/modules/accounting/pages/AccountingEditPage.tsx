import { useParams } from "react-router-dom";

export function AccountingEditPage() {
  const params = useParams<{ periodId: string }>();
  return (
    <div className="panel">
      <h1>Edit Accounting Record</h1>
      <p className="muted">Edit accounting settings for period {params.periodId ?? "(unknown)"}.</p>
    </div>
  );
}
