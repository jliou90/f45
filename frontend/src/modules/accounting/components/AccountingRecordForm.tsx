import {
  buildReferenceNumber,
  listWorkflowTypes,
  workflowTypeLabel,
  type AccountingRecordInput,
  type AccountingRecordStatus,
} from "../api";

type Props = {
  value: AccountingRecordInput;
  submitLabel: string;
  busy?: boolean;
  onChange: (next: AccountingRecordInput) => void;
  onSubmit: () => void;
};

const STATUS_OPTIONS: AccountingRecordStatus[] = ["draft", "in_review", "approved", "posted", "archived"];

export function AccountingRecordForm({ value, submitLabel, busy = false, onChange, onSubmit }: Props) {
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="row">
        <label style={{ minWidth: 220 }}>
          Workflow Type
          <select
            className="uiSelect"
            value={value.workflowType}
            onChange={(event) => onChange({ ...value, workflowType: event.target.value as AccountingRecordInput["workflowType"] })}
          >
            {listWorkflowTypes().map((type) => (
              <option key={type} value={type}>
                {workflowTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 180 }}>
          Status
          <select className="uiSelect" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as AccountingRecordStatus })}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 220 }}>
          Period ID
          <input value={value.periodId} onChange={(event) => onChange({ ...value, periodId: event.target.value })} placeholder="2026-03" />
        </label>
      </div>

      <div className="row">
        <label style={{ minWidth: 280 }}>
          Reference Number
          <input value={value.referenceNumber} onChange={(event) => onChange({ ...value, referenceNumber: event.target.value })} />
        </label>
        <button
          type="button"
          onClick={() => onChange({ ...value, referenceNumber: buildReferenceNumber(value.workflowType, value.periodId) })}
        >
          Generate Ref
        </button>
        <label style={{ minWidth: 300 }}>
          Title
          <input value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} />
        </label>
      </div>

      <div className="row">
        <label style={{ minWidth: 180 }}>
          Effective Date
          <input type="date" value={value.effectiveDate} onChange={(event) => onChange({ ...value, effectiveDate: event.target.value })} />
        </label>
        <label style={{ minWidth: 180 }}>
          Due Date
          <input type="date" value={value.dueDate} onChange={(event) => onChange({ ...value, dueDate: event.target.value })} />
        </label>
        <label style={{ minWidth: 220 }}>
          Employee ID
          <input value={value.employeeId} onChange={(event) => onChange({ ...value, employeeId: event.target.value })} placeholder="EMP-102" />
        </label>
        <label style={{ minWidth: 280 }}>
          Counterparty
          <input value={value.counterparty} onChange={(event) => onChange({ ...value, counterparty: event.target.value })} placeholder="Vendor / Customer / Bank" />
        </label>
      </div>

      <div className="row">
        <label style={{ minWidth: 180 }}>
          Tax Amount
          <input
            type="number"
            step="0.01"
            value={value.taxAmount}
            onChange={(event) => onChange({ ...value, taxAmount: Number(event.target.value || 0) })}
          />
        </label>
        <label style={{ minWidth: 180 }}>
          Commission Rate %
          <input
            type="number"
            step="0.01"
            value={value.commissionRate}
            onChange={(event) => onChange({ ...value, commissionRate: Number(event.target.value || 0) })}
          />
        </label>
      </div>

      <div className="stack">
        <h3>Line Items</h3>
        {value.lineItems.map((line, index) => (
          <div key={line.id} className="row">
            <label>
              Label
              <input
                value={line.label}
                onChange={(event) =>
                  onChange({
                    ...value,
                    lineItems: value.lineItems.map((item, nextIndex) => (nextIndex === index ? { ...item, label: event.target.value } : item)),
                  })
                }
              />
            </label>
            <label>
              GL Code
              <input
                value={line.glCode}
                onChange={(event) =>
                  onChange({
                    ...value,
                    lineItems: value.lineItems.map((item, nextIndex) => (nextIndex === index ? { ...item, glCode: event.target.value } : item)),
                  })
                }
              />
            </label>
            <label>
              Qty
              <input
                type="number"
                step="1"
                value={line.quantity}
                onChange={(event) =>
                  onChange({
                    ...value,
                    lineItems: value.lineItems.map((item, nextIndex) => (nextIndex === index ? { ...item, quantity: Number(event.target.value || 0) } : item)),
                  })
                }
              />
            </label>
            <label>
              Unit Amount
              <input
                type="number"
                step="0.01"
                value={line.unitAmount}
                onChange={(event) =>
                  onChange({
                    ...value,
                    lineItems: value.lineItems.map((item, nextIndex) => (nextIndex === index ? { ...item, unitAmount: Number(event.target.value || 0) } : item)),
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() => onChange({ ...value, lineItems: value.lineItems.filter((_, nextIndex) => nextIndex !== index) })}
              disabled={value.lineItems.length <= 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              lineItems: [...value.lineItems, { id: `line-${Date.now()}`, label: "", glCode: "", quantity: 1, unitAmount: 0 }],
            })
          }
        >
          Add Line Item
        </button>
      </div>

      <div className="stack">
        <h3>Checklist</h3>
        {value.checklist.map((item, index) => (
          <div key={`${item}-${index}`} className="row">
            <input
              value={item}
              onChange={(event) =>
                onChange({
                  ...value,
                  checklist: value.checklist.map((row, nextIndex) => (nextIndex === index ? event.target.value : row)),
                })
              }
            />
            <button type="button" onClick={() => onChange({ ...value, checklist: value.checklist.filter((_, nextIndex) => nextIndex !== index) })}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...value, checklist: [...value.checklist, ""] })}>
          Add Checklist Item
        </button>
      </div>

      <label>
        Notes
        <textarea
          rows={5}
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          style={{ border: "1px solid #c7d0df", borderRadius: 8, padding: "0.5rem 0.65rem", width: "100%" }}
        />
      </label>

      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

