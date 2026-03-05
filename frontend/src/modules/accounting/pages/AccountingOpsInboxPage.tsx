import { Link } from "react-router-dom";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { useQuery } from "../../../lib/query";
import {
  getAccountingOpsState,
  listAccountingRecordsPage,
  resolveRoPostingException,
  setApprovalStatus,
  setJournalStatus,
  type AccountingOpsState,
} from "../api";

export function AccountingOpsInboxPage() {
  const opsQuery = useQuery(() => getAccountingOpsState());
  const reviewQuery = useQuery(() => listAccountingRecordsPage({ status: "in_review", size: 20, page: 1 }));

  const runAction = async (action: () => Promise<AccountingOpsState>) => {
    await action();
    await Promise.all([opsQuery.refetch(), reviewQuery.refetch()]);
  };

  if (opsQuery.isLoading || reviewQuery.isLoading) {
    return <div className="panel">Loading accounting inbox...</div>;
  }

  if (opsQuery.error) {
    return <ErrorPanel error={opsQuery.error} title="Unable to load accounting inbox" />;
  }

  if (!opsQuery.data) {
    return <div className="panel">No accounting inbox data.</div>;
  }

  const pendingApprovals = opsQuery.data.approvals.filter((row) => row.status === "pending");
  const unresolvedExceptions = opsQuery.data.roExceptions.filter((row) => !row.resolved);
  const nonPostedJournals = opsQuery.data.journals.filter((row) => row.status !== "posted");

  return (
    <div className="stack">
      <div className="panel">
        <h1>Accounting Inbox</h1>
        <p className="muted">Central queue for approvals, posting exceptions, review-stage records, and unposted journals.</p>
        <div className="row">
          <Link to="/dms/accounting" className="uiButton uiButtonSecondary">
            Back to Accounting
          </Link>
          <span className="badge warn">{pendingApprovals.length} pending approvals</span>
          <span className="badge warn">{unresolvedExceptions.length} unresolved exceptions</span>
          <span className="badge neutral">{reviewQuery.data?.items.length ?? 0} records in review</span>
          <span className="badge neutral">{nonPostedJournals.length} unposted journals</span>
        </div>
      </div>

      <div className="panel stack">
        <h2>Pending Approvals</h2>
        {pendingApprovals.length === 0 ? <p className="muted">No pending approvals.</p> : null}
        {pendingApprovals.map((row) => (
          <div key={row.id} className="row">
            <span>{row.area}</span>
            <span className="muted">{row.entityId}</span>
            <button type="button" onClick={() => void runAction(() => setApprovalStatus(row.id, "approved"))}>Approve</button>
            <button type="button" onClick={() => void runAction(() => setApprovalStatus(row.id, "rejected"))}>Reject</button>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>RO Exceptions</h2>
        {unresolvedExceptions.length === 0 ? <p className="muted">No unresolved RO exceptions.</p> : null}
        {unresolvedExceptions.map((row) => (
          <div key={row.id} className="row">
            <span>{row.roId}</span>
            <span>{row.reason}</span>
            <span>${row.amount.toFixed(2)}</span>
            <button type="button" onClick={() => void runAction(() => resolveRoPostingException(row.id))}>Resolve</button>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>Workflow Records In Review</h2>
        {reviewQuery.data && reviewQuery.data.items.length === 0 ? <p className="muted">No records awaiting review.</p> : null}
        {reviewQuery.data?.items.map((row) => (
          <div key={row.id} className="row">
            <Link to={`/dms/accounting/${row.id}`}>{row.referenceNumber || row.title || row.id}</Link>
            <span className="badge neutral">{row.workflowType}</span>
            <span className="badge warn">{row.status}</span>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <h2>Unposted Journals</h2>
        {nonPostedJournals.length === 0 ? <p className="muted">All journals posted.</p> : null}
        {nonPostedJournals.map((row) => (
          <div key={row.id} className="row">
            <span>{row.memo || row.id}</span>
            <span className="badge neutral">{row.status}</span>
            {row.status !== "review" ? <button type="button" onClick={() => void runAction(() => setJournalStatus(row.id, "review"))}>Move to Review</button> : null}
            <button type="button" onClick={() => void runAction(() => setJournalStatus(row.id, "posted"))}>Post</button>
          </div>
        ))}
      </div>
    </div>
  );
}
