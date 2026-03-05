import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import { AccountingRecordForm } from "../components/AccountingRecordForm";
import { emptyAccountingRecordInput, getAccountingRecord, updateAccountingRecord, type AccountingRecordInput } from "../api";

export function AccountingEditPage() {
  const navigate = useNavigate();
  const params = useParams<{ recordId: string }>();
  const recordId = params.recordId ?? "";
  const recordQuery = useQuery(() => getAccountingRecord(recordId), { enabled: Boolean(recordId), deps: [recordId] });
  const [form, setForm] = useState<AccountingRecordInput>(emptyAccountingRecordInput("po_sheet"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordQuery.data) return;
    setForm({
      periodId: recordQuery.data.periodId,
      workflowType: recordQuery.data.workflowType,
      status: recordQuery.data.status,
      title: recordQuery.data.title,
      referenceNumber: recordQuery.data.referenceNumber,
      effectiveDate: recordQuery.data.effectiveDate,
      dueDate: recordQuery.data.dueDate,
      employeeId: recordQuery.data.employeeId,
      counterparty: recordQuery.data.counterparty,
      notes: recordQuery.data.notes,
      checklist: recordQuery.data.checklist,
      lineItems: recordQuery.data.lineItems,
      taxAmount: recordQuery.data.taxAmount,
      commissionRate: recordQuery.data.commissionRate,
    });
  }, [recordQuery.data]);

  async function onSave() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.referenceNumber.trim()) {
      setError("Reference number is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAccountingRecord(recordId, form);
      navigate(`/dms/accounting/${updated.id}`, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update accounting record.");
    } finally {
      setSaving(false);
    }
  }

  if (recordQuery.isLoading) {
    return <div className="panel">Loading accounting record...</div>;
  }

  if (recordQuery.error) {
    return <ErrorPanel error={recordQuery.error} title="Failed to load accounting record" />;
  }

  if (!recordQuery.data) {
    return (
      <div className="panel">
        <h1>Edit Accounting Record</h1>
        <p className="muted">Record not found.</p>
        <p>
          <Link to="/dms/accounting">Return to Accounting</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="panel">
        <h1>Edit Accounting Record</h1>
        <p className="muted">{recordQuery.data.referenceNumber}</p>
      </div>
      <div className="panel">
        <AccountingRecordForm value={form} onChange={setForm} onSubmit={() => void onSave()} submitLabel="Save Changes" busy={saving} />
        {error ? <p className="muted">{error}</p> : null}
      </div>
    </div>
  );
}

