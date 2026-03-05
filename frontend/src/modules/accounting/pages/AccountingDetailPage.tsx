import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import { deleteAccountingRecord, getAccountingRecord, totalRecordAmount, workflowTypeLabel } from "../api";

export function AccountingDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ recordId: string }>();
  const recordId = params.recordId ?? "";
  const recordQuery = useQuery(() => getAccountingRecord(recordId), { enabled: Boolean(recordId), deps: [recordId] });

  if (recordQuery.isLoading) {
    return <div className="panel">Loading accounting record...</div>;
  }

  if (recordQuery.error) {
    return <ErrorPanel error={recordQuery.error} title="Failed to load accounting record" />;
  }

  if (!recordQuery.data) {
    return (
      <div className="panel">
        <h1>Accounting Record</h1>
        <p className="muted">Record not found.</p>
        <p>
          <Link to="/dms/accounting">Return to Accounting</Link>
        </p>
      </div>
    );
  }

  const record = recordQuery.data;

  return (
    <div className="stack">
      <div className="panel">
        <h1>{record.title}</h1>
        <p className="muted">
          {workflowTypeLabel(record.workflowType)} | {record.referenceNumber} | {record.status}
        </p>
        <div className="row">
          <span className="badge neutral">Period {record.periodId || "Open"}</span>
          <span className="badge neutral">Effective {record.effectiveDate || "-"}</span>
          <span className="badge neutral">Due {record.dueDate || "-"}</span>
          <span className="badge ok">${totalRecordAmount(record).toFixed(2)} total</span>
        </div>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <Link to={`/dms/accounting/${record.id}/edit`} className="uiButton uiButtonPrimary">
            Edit Record
          </Link>
          <button
            type="button"
            className="uiButton uiButtonDanger"
            onClick={() => {
              void (async () => {
                await deleteAccountingRecord(record.id);
                navigate("/dms/accounting", { replace: true });
              })();
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="panel stack">
        <h3>Operational Fields</h3>
        <p>
          <strong>Employee:</strong> {record.employeeId || "-"}
        </p>
        <p>
          <strong>Counterparty:</strong> {record.counterparty || "-"}
        </p>
        <p>
          <strong>Tax:</strong> ${record.taxAmount.toFixed(2)}
        </p>
        <p>
          <strong>Commission Rate:</strong> {record.commissionRate.toFixed(2)}%
        </p>
        <p>
          <strong>Notes:</strong> {record.notes || "-"}
        </p>
      </div>

      <div className="panel stack">
        <h3>Line Items</h3>
        {record.lineItems.map((line) => (
          <div key={line.id} className="row">
            <span>{line.label || "(untitled)"}</span>
            <span className="muted">GL {line.glCode || "-"}</span>
            <span className="muted">
              {line.quantity} x ${line.unitAmount.toFixed(2)}
            </span>
            <span>${(line.quantity * line.unitAmount).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h3>Checklist</h3>
        {record.checklist.length === 0 ? <p className="muted">No checklist items.</p> : null}
        {record.checklist.map((item, index) => (
          <div key={`${item}-${index}`}>{item || "(blank item)"}</div>
        ))}
      </div>
    </div>
  );
}

