import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import {
  addCommissionSheet,
  addDealFundingChecklist,
  addFixedAsset,
  addJournalEntry,
  addReconciliation,
  addReceivable,
  addRoPostingException,
  addTaxFiling,
  addVendorInvoice,
  applyReceivablePayment,
  clearReconciliation,
  closePeriod,
  disposeFixedAsset,
  getAccountingOpsState,
  reopenPeriod,
  resolveRoPostingException,
  setApprovalStatus,
  setCommissionStatus,
  setDealFundingFlags,
  setJournalStatus,
  setTaxFilingStatus,
  setVendorInvoiceStatus,
  summarizeAccountingOps,
  type AccountingOpsState,
} from "../api";

export function AccountingControlCenterPage() {
  const opsQuery = useQuery(() => getAccountingOpsState());
  const [periodId, setPeriodId] = useState("");
  const [lockDate, setLockDate] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const ops = opsQuery.data;
  const summary = useMemo(() => (ops ? summarizeAccountingOps(ops) : null), [ops]);

  async function run(action: () => Promise<AccountingOpsState>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await opsQuery.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Accounting action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (opsQuery.isLoading) {
    return <div className="panel">Loading accounting control center...</div>;
  }

  if (opsQuery.error) {
    return <ErrorPanel error={opsQuery.error} title="Failed to load accounting control center" />;
  }

  if (!ops || !summary) {
    return <div className="panel">No accounting control center state available.</div>;
  }

  return (
    <div className="stack">
      <div className="panel">
        <h1>Accounting Control Center</h1>
        <p className="muted">Period controls, GL/AP/AR, tax, commission, reconciliation, assets, approvals, and audit operations.</p>
        <div className="row">
          <Link to="/dms/accounting" className="uiButton uiButtonSecondary">
            Back to Records
          </Link>
          <span className="badge neutral">{summary.openJournals} open journals</span>
          <span className="badge neutral">{summary.unpaidInvoices} unpaid AP invoices</span>
          <span className="badge neutral">{summary.openReceivables} open AR</span>
          <span className="badge warn">{summary.pendingApprovals} pending approvals</span>
          <span className="badge warn">{summary.unresolvedRoExceptions} RO exceptions</span>
        </div>
        {actionError ? <p className="muted">{actionError}</p> : null}
      </div>

      <div className="panel stack">
        <h2>1) Period Close Controls</h2>
        <div className="row">
          <input value={periodId} onChange={(event) => setPeriodId(event.target.value)} placeholder="Period ID (2026-03)" />
          <input type="date" value={lockDate} onChange={(event) => setLockDate(event.target.value)} />
          <input value={closeNotes} onChange={(event) => setCloseNotes(event.target.value)} placeholder="Close notes" />
          <button type="button" disabled={busy} onClick={() => void run(() => closePeriod(periodId, lockDate, closeNotes, false))}>Soft Close</button>
          <button type="button" disabled={busy} onClick={() => void run(() => closePeriod(periodId, lockDate, closeNotes, true))}>Hard Close</button>
          <button type="button" disabled={busy} onClick={() => void run(() => reopenPeriod(periodId))}>Reopen</button>
        </div>
        {ops.periodControls.map((row) => (
          <div key={row.id} className="row">
            <span>{row.periodId}</span>
            <span className="badge neutral">{row.status}</span>
            <span className="muted">lock {row.lockDate || "-"}</span>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>2) GL Operations (Journals)</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addJournalEntry({ periodId: periodId || "OPEN", memo: "Monthly accrual", amount: 1250, entryDate: new Date().toISOString().slice(0, 10) }))}>Add Journal Draft</button>
        {ops.journals.map((row) => (
          <div key={row.id} className="row">
            <span>{row.memo}</span>
            <span>${row.amount.toFixed(2)}</span>
            <span className="badge neutral">{row.status}</span>
            <button type="button" disabled={busy} onClick={() => void run(() => setJournalStatus(row.id, "review"))}>Review</button>
            <button type="button" disabled={busy} onClick={() => void run(() => setJournalStatus(row.id, "posted"))}>Post</button>
            <button type="button" disabled={busy} onClick={() => void run(() => setJournalStatus(row.id, "reversed"))}>Reverse</button>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>3) AP + Payments</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addVendorInvoice({ vendorName: "Vendor Co", invoiceNo: `INV-${Date.now().toString().slice(-5)}`, amount: 980, dueDate: new Date().toISOString().slice(0, 10) }))}>Add AP Invoice</button>
        {ops.vendorInvoices.map((row) => (
          <div key={row.id} className="row">
            <span>{row.vendorName}</span>
            <span>{row.invoiceNo}</span>
            <span>${row.amount.toFixed(2)}</span>
            <span className="badge neutral">{row.status}</span>
            <button type="button" disabled={busy} onClick={() => void run(() => setVendorInvoiceStatus(row.id, "approved"))}>Approve</button>
            <button type="button" disabled={busy} onClick={() => void run(() => setVendorInvoiceStatus(row.id, "paid"))}>Pay</button>
            <button type="button" disabled={busy} onClick={() => void run(() => setVendorInvoiceStatus(row.id, "void"))}>Void</button>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>4) AR + Cash</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addReceivable({ customerName: "Retail Customer", amountDue: 1450, dueDate: new Date().toISOString().slice(0, 10) }))}>Add Receivable</button>
        {ops.receivables.map((row) => (
          <div key={row.id} className="row">
            <span>{row.customerName}</span>
            <span>${row.amountDue.toFixed(2)}</span>
            <span>paid ${row.amountPaid.toFixed(2)}</span>
            <span className="badge neutral">{row.status}</span>
            <button type="button" disabled={busy} onClick={() => void run(() => applyReceivablePayment(row.id, 250))}>Apply $250</button>
            <button type="button" disabled={busy} onClick={() => void run(() => applyReceivablePayment(row.id, row.amountDue))}>Pay In Full</button>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>5) Deal Accounting</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addDealFundingChecklist(`DEAL-${Date.now().toString().slice(-4)}`, "Customer Name"))}>Add Funding Checklist</button>
        {ops.dealFunding.map((row) => (
          <div key={row.id} className="row">
            <span>{row.dealId}</span>
            <span>{row.customerName}</span>
            <span className="badge neutral">{row.readyToFund ? "ready to fund" : "not ready"}</span>
            <button type="button" disabled={busy} onClick={() => void run(() => setDealFundingFlags(row.id, { docsReceived: true, stipsClear: row.stipsClear, readyToFund: true && row.stipsClear }))}>Docs Received</button>
            <button type="button" disabled={busy} onClick={() => void run(() => setDealFundingFlags(row.id, { docsReceived: row.docsReceived, stipsClear: true, readyToFund: row.docsReceived && true }))}>Stips Clear</button>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>6) Service/Parts Accounting</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addRoPostingException(`RO-${Date.now().toString().slice(-4)}`, "Labor/parts tax mismatch", 85))}>Add RO Exception</button>
        {ops.roExceptions.map((row) => (
          <div key={row.id} className="row">
            <span>{row.roId}</span>
            <span>{row.reason}</span>
            <span>${row.amount.toFixed(2)}</span>
            <span className={`badge ${row.resolved ? "ok" : "warn"}`}>{row.resolved ? "resolved" : "open"}</span>
            {!row.resolved ? <button type="button" disabled={busy} onClick={() => void run(() => resolveRoPostingException(row.id))}>Resolve</button> : null}
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>7) Payroll/Commission Controls</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addCommissionSheet({ employeeId: "EMP-100", employeeName: "Sales Rep", grossAmount: 8900, commissionRate: 8, holdbackAmount: 250 }))}>Add Commission Wash Sheet</button>
        {ops.commissions.map((row) => (
          <div key={row.id} className="row">
            <span>{row.employeeName}</span>
            <span>${row.grossAmount.toFixed(2)}</span>
            <span>{row.commissionRate.toFixed(2)}%</span>
            <span>holdback ${row.holdbackAmount.toFixed(2)}</span>
            <span className="badge neutral">{row.status}</span>
            <button type="button" disabled={busy} onClick={() => void run(() => setCommissionStatus(row.id, "approved"))}>Approve</button>
            <button type="button" disabled={busy} onClick={() => void run(() => setCommissionStatus(row.id, "exported"))}>Export</button>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>8) Tax Tools</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addTaxFiling({ jurisdiction: "TX", periodId: periodId || "2026-03", taxableBase: 50000, taxDue: 4125, dueDate: new Date().toISOString().slice(0, 10) }))}>Add Tax Filing</button>
        {ops.taxFilings.map((row) => (
          <div key={row.id} className="row">
            <span>{row.jurisdiction}</span>
            <span>{row.periodId}</span>
            <span>${row.taxDue.toFixed(2)}</span>
            <span className="badge neutral">{row.status}</span>
            <button type="button" disabled={busy} onClick={() => void run(() => setTaxFilingStatus(row.id, "ready"))}>Ready</button>
            <button type="button" disabled={busy} onClick={() => void run(() => setTaxFilingStatus(row.id, "filed"))}>Filed</button>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>9) Bank/Statement Reconciliation</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addReconciliation({ accountName: "Main Operating", statementDate: new Date().toISOString().slice(0, 10), statementBalance: 120000, bookBalance: 119450 }))}>Add Reconciliation Run</button>
        {ops.reconciliations.map((row) => (
          <div key={row.id} className="row">
            <span>{row.accountName}</span>
            <span>diff ${row.difference.toFixed(2)}</span>
            <span className={`badge ${row.status === "cleared" ? "ok" : "warn"}`}>{row.status}</span>
            {row.status === "open" ? <button type="button" disabled={busy} onClick={() => void run(() => clearReconciliation(row.id))}>Mark Cleared</button> : null}
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>10) Fixed Assets</h2>
        <button type="button" disabled={busy} onClick={() => void run(() => addFixedAsset({ assetTag: `ASSET-${Date.now().toString().slice(-4)}`, description: "Service Lift", cost: 18500, inServiceDate: new Date().toISOString().slice(0, 10), usefulLifeMonths: 84 }))}>Add Fixed Asset</button>
        {ops.assets.map((row) => (
          <div key={row.id} className="row">
            <span>{row.assetTag}</span>
            <span>{row.description}</span>
            <span>${row.cost.toFixed(2)}</span>
            <span className="badge neutral">{row.status}</span>
            {row.status === "active" ? <button type="button" disabled={busy} onClick={() => void run(() => disposeFixedAsset(row.id))}>Dispose</button> : null}
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>11) Audit + Approval Controls</h2>
        <p className="muted">Maker-checker approvals and immutable UI audit feed for high-risk actions.</p>
        {ops.approvals.map((row) => (
          <div key={row.id} className="row">
            <span>{row.area}</span>
            <span>{row.entityId}</span>
            <span className="badge neutral">{row.status}</span>
            {row.status === "pending" ? (
              <>
                <button type="button" disabled={busy} onClick={() => void run(() => setApprovalStatus(row.id, "approved"))}>Approve</button>
                <button type="button" disabled={busy} onClick={() => void run(() => setApprovalStatus(row.id, "rejected"))}>Reject</button>
              </>
            ) : null}
          </div>
        ))}
        <div className="stack">
          {ops.auditTrail.slice(0, 20).map((row) => (
            <div key={row.id} className="timelineItem">
              <strong>{row.action}</strong> {row.detail}
              <div className="muted">{new Date(row.happenedAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel stack">
        <h2>12) Reporting + Export Summary</h2>
        <p className="muted">CFO snapshots generated from current operational state.</p>
        <div className="row">
          <span className="badge neutral">Open journals: {summary.openJournals}</span>
          <span className="badge neutral">Open AP: {summary.unpaidInvoices}</span>
          <span className="badge neutral">Open AR: {summary.openReceivables}</span>
          <span className="badge neutral">Open tax filings: {summary.openTaxFilings}</span>
          <span className="badge neutral">Open reconciliations: {summary.openReconciliations}</span>
        </div>
      </div>
    </div>
  );
}
