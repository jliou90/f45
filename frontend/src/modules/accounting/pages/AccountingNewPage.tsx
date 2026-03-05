import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccountingRecordForm } from "../components/AccountingRecordForm";
import { createAccountingRecord, emptyAccountingRecordInput, listWorkflowTypes, type AccountingWorkflowType } from "../api";

export function AccountingNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type");
  const selectedType: AccountingWorkflowType = listWorkflowTypes().includes(initialType as AccountingWorkflowType)
    ? (initialType as AccountingWorkflowType)
    : "po_sheet";
  const [form, setForm] = useState(() => emptyAccountingRecordInput(selectedType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const created = await createAccountingRecord(form);
      navigate(`/dms/accounting/${created.id}`, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to create accounting record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="panel">
        <h1>New Accounting Record</h1>
        <p className="muted">Create accounting workflow records for PO, RO, audit, tax, employee, commission, agreements, and hot sheets.</p>
      </div>
      <div className="panel">
        <AccountingRecordForm value={form} onChange={setForm} onSubmit={() => void onSave()} submitLabel="Create Record" busy={saving} />
        {error ? <p className="muted">{error}</p> : null}
      </div>
    </div>
  );
}
