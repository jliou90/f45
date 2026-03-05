import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../../components/DataTable";
import { ErrorPanel } from "../../../components/ErrorPanel";
import { PortalSearchPanel } from "../../../components/PortalSearchPanel";
import { useQuery } from "../../../lib/query";
import {
  listAccountingRecordsPage,
  listAccountingPeriods,
  listWorkflowTypes,
  totalRecordAmount,
  workflowTypeLabel,
  type AccountingRecordStatus,
  type AccountingWorkflowType,
} from "../api";

const STATUS_OPTIONS: Array<AccountingRecordStatus | "all"> = ["all", "draft", "in_review", "approved", "posted", "archived"];

export function AccountingListPage() {
  const periodsQuery = useQuery(() => listAccountingPeriods());
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountingWorkflowType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AccountingRecordStatus | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const recordsQuery = useQuery(
    () =>
      listAccountingRecordsPage({
        q: search,
        workflowType: typeFilter,
        status: statusFilter,
        periodId: periodFilter,
        page,
        size: pageSize,
      }),
    {
      deps: [search, typeFilter, statusFilter, periodFilter, page],
    },
  );

  const rows = recordsQuery.data?.items ?? [];

  const totals = useMemo(
    () => ({
      count: recordsQuery.data?.total ?? 0,
      posted: rows.filter((row) => row.status === "posted").length,
      inReview: rows.filter((row) => row.status === "in_review").length,
      amount: rows.reduce((sum, row) => sum + totalRecordAmount(row), 0),
    }),
    [recordsQuery.data?.total, rows],
  );

  return (
    <div className="stack">
      <PortalSearchPanel title="Smart Search" defaultModules={["accounting", "customers"]} />
      <div className="panel">
        <h1>Accounting Operations</h1>
        <p className="muted">
          PO sheets, RO forms, audit/tax tools, employee and commission wash sheets, purchase agreements, and hot sheets.
        </p>
      </div>

      <div className="panel stack">
        <div className="row">
          <Link to="/dms/accounting/new" className="uiButton uiButtonPrimary">
            New Record
          </Link>
          <Link to="/dms/accounting/control-center" className="uiButton uiButtonSecondary">
            Control Center
          </Link>
          <Link to="/dms/accounting/inbox" className="uiButton uiButtonSecondary">
            Ops Inbox
          </Link>
          <span className="badge neutral">{totals.count} records</span>
          <span className="badge neutral">{totals.inReview} in review</span>
          <span className="badge ok">{totals.posted} posted</span>
          <span className="badge neutral">${totals.amount.toFixed(2)} total value</span>
        </div>
        <div className="row">
          {listWorkflowTypes().map((type) => (
            <Link key={type} to={`/dms/accounting/new?type=${type}`} className="uiButton uiButtonSecondary">
              {workflowTypeLabel(type)}
            </Link>
          ))}
        </div>
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchDraft.trim());
            setPage(1);
          }}
        >
          <input
            aria-label="Search accounting records"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search by reference, title, notes, employee, counterparty"
          />
          <select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as AccountingWorkflowType | "all");
              setPage(1);
            }}
          >
            <option value="all">All Types</option>
            {listWorkflowTypes().map((type) => (
              <option key={type} value={type}>
                {workflowTypeLabel(type)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as AccountingRecordStatus | "all");
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All Statuses" : status}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by period"
            value={periodFilter}
            onChange={(event) => {
              setPeriodFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Periods</option>
            {(periodsQuery.data ?? []).map((period) => (
              <option key={period.id} value={period.id}>
                {period.id}
              </option>
            ))}
          </select>
          <button type="submit">Search</button>
        </form>
      </div>

      {periodsQuery.error ? <ErrorPanel error={periodsQuery.error} title="Unable to load accounting periods" /> : null}
      {recordsQuery.error ? <ErrorPanel error={recordsQuery.error} title="Unable to load accounting records" /> : null}

      <div className="panel">
        {recordsQuery.isLoading ? <p>Loading accounting records...</p> : null}
        {recordsQuery.data ? (
          <div className="row">
            <span className="badge neutral">
              Page {recordsQuery.data.page} of {Math.max(1, Math.ceil(recordsQuery.data.total / recordsQuery.data.size))}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={recordsQuery.isLoading || recordsQuery.data.page <= 1}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={recordsQuery.isLoading || recordsQuery.data.page * recordsQuery.data.size >= recordsQuery.data.total}
            >
              Next
            </button>
          </div>
        ) : null}
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "referenceNumber",
              header: "Reference",
              render: (row) => <Link to={`/dms/accounting/${row.id}`}>{row.referenceNumber || row.id}</Link>,
            },
            {
              key: "workflowType",
              header: "Type",
              render: (row) => workflowTypeLabel(row.workflowType),
            },
            { key: "title", header: "Title", render: (row) => row.title },
            { key: "periodId", header: "Period", render: (row) => row.periodId || "-" },
            { key: "status", header: "Status", render: (row) => row.status },
            {
              key: "amount",
              header: "Amount",
              render: (row) => `$${totalRecordAmount(row).toFixed(2)}`,
            },
            { key: "updatedAt", header: "Updated", render: (row) => new Date(row.updatedAt).toLocaleString() },
          ]}
        />
        {rows.length === 0 ? <p className="muted">No accounting records match the current filters.</p> : null}
      </div>
    </div>
  );
}
