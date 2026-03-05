import { kutmApi } from "../../lib/kutm";

type PageMeta = { page: number; size: number; total: number };
type PageWithMeta<T> = { items?: T[]; meta?: PageMeta };

export type AccountingPeriod = {
  id: string;
  status?: string | null;
  year?: number | null;
  month?: number | null;
};

type PeriodPage = {
  items: AccountingPeriod[];
};

export type AccountingWorkflowType =
  | "po_sheet"
  | "ro_form"
  | "audit_tool"
  | "tax_tool"
  | "employee_tool"
  | "commission_wash"
  | "purchase_agreement"
  | "hot_sheet";

export type AccountingRecordStatus = "draft" | "in_review" | "approved" | "posted" | "archived";

export type AccountingLineItem = {
  id: string;
  label: string;
  glCode: string;
  quantity: number;
  unitAmount: number;
};

export type AccountingRecord = {
  id: string;
  tenantId: string;
  periodId: string;
  workflowType: AccountingWorkflowType;
  status: AccountingRecordStatus;
  title: string;
  referenceNumber: string;
  effectiveDate: string;
  dueDate: string;
  employeeId: string;
  counterparty: string;
  notes: string;
  checklist: string[];
  lineItems: AccountingLineItem[];
  taxAmount: number;
  commissionRate: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountingRecordInput = Omit<AccountingRecord, "id" | "tenantId" | "createdAt" | "updatedAt">;

const WORKFLOW_LABELS: Record<AccountingWorkflowType, string> = {
  po_sheet: "PO Sheet",
  ro_form: "RO Form",
  audit_tool: "Audit Tool",
  tax_tool: "Tax Tool",
  employee_tool: "Employee Tool",
  commission_wash: "Commission Wash",
  purchase_agreement: "Purchase Agreement",
  hot_sheet: "Hot Sheet",
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function workflowTypeLabel(type: AccountingWorkflowType): string {
  return WORKFLOW_LABELS[type];
}

export function listWorkflowTypes(): AccountingWorkflowType[] {
  return Object.keys(WORKFLOW_LABELS) as AccountingWorkflowType[];
}

export async function listAccountingPeriods(): Promise<AccountingPeriod[]> {
  const response = await kutmApi.get<PeriodPage>("/acct/periods", { page: 1, size: 100 }, true);
  return response.items ?? [];
}

export async function getAccountingPeriod(periodId: string): Promise<AccountingPeriod | null> {
  const rows = await listAccountingPeriods();
  return rows.find((row) => row.id === periodId) ?? null;
}

export async function listAccountingRecords(): Promise<AccountingRecord[]> {
  return listAccountingRecordsPage().then((result) => result.items);
}

export type AccountingRecordSearchParams = {
  q?: string;
  workflowType?: AccountingWorkflowType | "all";
  status?: AccountingRecordStatus | "all";
  periodId?: string | "all";
  page?: number;
  size?: number;
};

export type AccountingRecordPage = {
  items: AccountingRecord[];
  page: number;
  size: number;
  total: number;
};

export async function listAccountingRecordsPage(params?: AccountingRecordSearchParams): Promise<AccountingRecordPage> {
  const page = params?.page ?? 1;
  const size = params?.size ?? 25;
  const response = await kutmApi.get<PageWithMeta<AccountingRecord>>(
    "/acct/workflow-records",
    {
      q: params?.q?.trim() || undefined,
      workflow_type: params?.workflowType && params.workflowType !== "all" ? params.workflowType : undefined,
      status: params?.status && params.status !== "all" ? params.status : undefined,
      period_id: params?.periodId && params.periodId !== "all" ? params.periodId : undefined,
      page,
      size,
    },
    true,
  );
  return {
    items: response.items ?? [],
    page: response.meta?.page ?? page,
    size: response.meta?.size ?? size,
    total: response.meta?.total ?? 0,
  };
}

export async function getAccountingRecord(recordId: string): Promise<AccountingRecord | null> {
  try {
    return await kutmApi.get<AccountingRecord>(`/acct/workflow-records/${encodeURIComponent(recordId)}`, undefined, true);
  } catch {
    return null;
  }
}

export async function createAccountingRecord(input: AccountingRecordInput): Promise<AccountingRecord> {
  return kutmApi.post<AccountingRecord>("/acct/workflow-records", input, true);
}

export async function updateAccountingRecord(recordId: string, input: AccountingRecordInput): Promise<AccountingRecord> {
  return kutmApi.put<AccountingRecord>(`/acct/workflow-records/${encodeURIComponent(recordId)}`, input, true);
}

export async function deleteAccountingRecord(recordId: string): Promise<void> {
  await kutmApi.delete(`/acct/workflow-records/${encodeURIComponent(recordId)}`, true);
}

export function totalRecordAmount(record: AccountingRecord): number {
  const lineTotal = record.lineItems.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);
  const commissionAmount = lineTotal * (record.commissionRate / 100);
  return lineTotal + record.taxAmount + commissionAmount;
}

export function buildReferenceNumber(type: AccountingWorkflowType, periodId: string): string {
  const prefix = type.replace("_", "").slice(0, 6).toUpperCase();
  const period = (periodId || "OPEN").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${period}-${random}`;
}

function defaultRecordForType(type: AccountingWorkflowType, periodId = ""): AccountingRecordInput {
  return {
    periodId,
    workflowType: type,
    status: "draft",
    title: `${WORKFLOW_LABELS[type]} Draft`,
    referenceNumber: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    employeeId: "",
    counterparty: "",
    notes: "",
    checklist: ["Source documents attached", "Values verified", "Ready for review"],
    lineItems: [{ id: uid("line"), label: "", glCode: "", quantity: 1, unitAmount: 0 }],
    taxAmount: 0,
    commissionRate: 0,
  };
}

export function emptyAccountingRecordInput(type: AccountingWorkflowType, periodId = ""): AccountingRecordInput {
  return defaultRecordForType(type, periodId);
}

export type PeriodCloseStatus = "open" | "soft_closed" | "hard_closed";
export type AccountingPeriodControl = { id: string; periodId: string; lockDate: string; status: PeriodCloseStatus; closeNotes: string; updatedAt: string };
export type JournalStatus = "draft" | "review" | "posted" | "reversed";
export type JournalEntry = { id: string; periodId: string; memo: string; amount: number; entryDate: string; status: JournalStatus; updatedAt: string };
export type InvoiceStatus = "open" | "approved" | "paid" | "void";
export type VendorInvoice = { id: string; vendorName: string; invoiceNo: string; amount: number; dueDate: string; status: InvoiceStatus; updatedAt: string };
export type ReceivableStatus = "open" | "partial" | "paid" | "writeoff";
export type Receivable = { id: string; customerName: string; amountDue: number; amountPaid: number; dueDate: string; status: ReceivableStatus; updatedAt: string };
export type DealFundingChecklist = { id: string; dealId: string; customerName: string; docsReceived: boolean; stipsClear: boolean; readyToFund: boolean; updatedAt: string };
export type RoPostingException = { id: string; roId: string; reason: string; amount: number; resolved: boolean; updatedAt: string };
export type CommissionSheet = { id: string; employeeId: string; employeeName: string; grossAmount: number; commissionRate: number; holdbackAmount: number; status: "draft" | "approved" | "exported"; updatedAt: string };
export type TaxFiling = { id: string; jurisdiction: string; periodId: string; taxableBase: number; taxDue: number; dueDate: string; filedAt: string; status: "draft" | "ready" | "filed"; updatedAt: string };
export type ReconciliationRun = { id: string; accountName: string; statementDate: string; statementBalance: number; bookBalance: number; difference: number; status: "open" | "cleared"; updatedAt: string };
export type FixedAsset = { id: string; assetTag: string; description: string; cost: number; inServiceDate: string; usefulLifeMonths: number; status: "active" | "disposed"; updatedAt: string };
export type ApprovalRequest = { id: string; area: string; entityId: string; amount: number; requestedBy: string; status: "pending" | "approved" | "rejected"; updatedAt: string };
export type AccountingAuditEvent = { id: string; action: string; detail: string; happenedAt: string };

export type AccountingOpsState = {
  periodControls: AccountingPeriodControl[];
  journals: JournalEntry[];
  vendorInvoices: VendorInvoice[];
  receivables: Receivable[];
  dealFunding: DealFundingChecklist[];
  roExceptions: RoPostingException[];
  commissions: CommissionSheet[];
  taxFilings: TaxFiling[];
  reconciliations: ReconciliationRun[];
  assets: FixedAsset[];
  approvals: ApprovalRequest[];
  auditTrail: AccountingAuditEvent[];
};

type OpsStateResponse = {
  state: Partial<AccountingOpsState> | null;
  updated_at?: string | null;
};

type OpsActionResponse = {
  state: Partial<AccountingOpsState> | null;
  action: string;
  updated_at?: string | null;
};

function defaultOpsState(): AccountingOpsState {
  return {
    periodControls: [],
    journals: [],
    vendorInvoices: [],
    receivables: [],
    dealFunding: [],
    roExceptions: [],
    commissions: [],
    taxFilings: [],
    reconciliations: [],
    assets: [],
    approvals: [],
    auditTrail: [],
  };
}

function normalizeOpsState(value?: Partial<AccountingOpsState> | null): AccountingOpsState {
  const fallback = defaultOpsState();
  return {
    periodControls: value?.periodControls ?? fallback.periodControls,
    journals: value?.journals ?? fallback.journals,
    vendorInvoices: value?.vendorInvoices ?? fallback.vendorInvoices,
    receivables: value?.receivables ?? fallback.receivables,
    dealFunding: value?.dealFunding ?? fallback.dealFunding,
    roExceptions: value?.roExceptions ?? fallback.roExceptions,
    commissions: value?.commissions ?? fallback.commissions,
    taxFilings: value?.taxFilings ?? fallback.taxFilings,
    reconciliations: value?.reconciliations ?? fallback.reconciliations,
    assets: value?.assets ?? fallback.assets,
    approvals: value?.approvals ?? fallback.approvals,
    auditTrail: value?.auditTrail ?? fallback.auditTrail,
  };
}

export async function getAccountingOpsState(): Promise<AccountingOpsState> {
  const response = await kutmApi.get<OpsStateResponse>("/acct/ops/state", undefined, true);
  return normalizeOpsState(response.state);
}

export async function saveAccountingOpsState(state: AccountingOpsState): Promise<AccountingOpsState> {
  const response = await kutmApi.put<OpsStateResponse>("/acct/ops/state", { state }, true);
  return normalizeOpsState(response.state);
}

async function applyOpsAction(action: string, payload: Record<string, unknown>): Promise<AccountingOpsState> {
  const response = await kutmApi.post<OpsActionResponse>("/acct/ops/actions", { action, payload }, true);
  return normalizeOpsState(response.state);
}

export async function closePeriod(periodId: string, lockDate: string, closeNotes: string, hardClose: boolean): Promise<AccountingOpsState> {
  return applyOpsAction("period.close", { periodId, lockDate, closeNotes, hardClose });
}

export async function reopenPeriod(periodId: string): Promise<AccountingOpsState> {
  return applyOpsAction("period.reopen", { periodId });
}

export async function addJournalEntry(input: Pick<JournalEntry, "periodId" | "memo" | "amount" | "entryDate">): Promise<AccountingOpsState> {
  return applyOpsAction("journal.create", input);
}

export async function setJournalStatus(journalId: string, status: JournalStatus): Promise<AccountingOpsState> {
  return applyOpsAction("journal.status", { id: journalId, status });
}

export async function addVendorInvoice(input: Pick<VendorInvoice, "vendorName" | "invoiceNo" | "amount" | "dueDate">): Promise<AccountingOpsState> {
  return applyOpsAction("ap.invoice.create", input);
}

export async function setVendorInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<AccountingOpsState> {
  return applyOpsAction("ap.invoice.status", { id: invoiceId, status });
}

export async function addReceivable(input: Pick<Receivable, "customerName" | "amountDue" | "dueDate">): Promise<AccountingOpsState> {
  return applyOpsAction("ar.create", input);
}

export async function applyReceivablePayment(receivableId: string, amount: number): Promise<AccountingOpsState> {
  return applyOpsAction("ar.payment", { id: receivableId, amount });
}

export async function addDealFundingChecklist(dealId: string, customerName: string): Promise<AccountingOpsState> {
  return applyOpsAction("deal.create", { dealId, customerName });
}

export async function setDealFundingFlags(checklistId: string, values: Pick<DealFundingChecklist, "docsReceived" | "stipsClear" | "readyToFund">): Promise<AccountingOpsState> {
  return applyOpsAction("deal.update", { id: checklistId, ...values });
}

export async function addRoPostingException(roId: string, reason: string, amount: number): Promise<AccountingOpsState> {
  return applyOpsAction("ro.exception.create", { roId, reason, amount });
}

export async function resolveRoPostingException(exceptionId: string): Promise<AccountingOpsState> {
  return applyOpsAction("ro.exception.resolve", { id: exceptionId });
}

export async function addCommissionSheet(input: Pick<CommissionSheet, "employeeId" | "employeeName" | "grossAmount" | "commissionRate" | "holdbackAmount">): Promise<AccountingOpsState> {
  return applyOpsAction("commission.create", input);
}

export async function setCommissionStatus(sheetId: string, status: CommissionSheet["status"]): Promise<AccountingOpsState> {
  return applyOpsAction("commission.status", { id: sheetId, status });
}

export async function addTaxFiling(input: Pick<TaxFiling, "jurisdiction" | "periodId" | "taxableBase" | "taxDue" | "dueDate">): Promise<AccountingOpsState> {
  return applyOpsAction("tax.create", input);
}

export async function setTaxFilingStatus(filingId: string, status: TaxFiling["status"]): Promise<AccountingOpsState> {
  return applyOpsAction("tax.status", { id: filingId, status });
}

export async function addReconciliation(input: Pick<ReconciliationRun, "accountName" | "statementDate" | "statementBalance" | "bookBalance">): Promise<AccountingOpsState> {
  return applyOpsAction("recon.create", input);
}

export async function clearReconciliation(reconId: string): Promise<AccountingOpsState> {
  return applyOpsAction("recon.clear", { id: reconId });
}

export async function addFixedAsset(input: Pick<FixedAsset, "assetTag" | "description" | "cost" | "inServiceDate" | "usefulLifeMonths">): Promise<AccountingOpsState> {
  return applyOpsAction("asset.create", input);
}

export async function disposeFixedAsset(assetId: string): Promise<AccountingOpsState> {
  return applyOpsAction("asset.dispose", { id: assetId });
}

export async function setApprovalStatus(approvalId: string, status: ApprovalRequest["status"]): Promise<AccountingOpsState> {
  return applyOpsAction("approval.status", { id: approvalId, status });
}

export type AccountingOpsSummary = {
  openJournals: number;
  unpaidInvoices: number;
  openReceivables: number;
  unresolvedRoExceptions: number;
  pendingApprovals: number;
  openReconciliations: number;
  openTaxFilings: number;
  activeAssets: number;
};

export function summarizeAccountingOps(state: AccountingOpsState): AccountingOpsSummary {
  return {
    openJournals: state.journals.filter((row) => row.status !== "posted").length,
    unpaidInvoices: state.vendorInvoices.filter((row) => row.status !== "paid" && row.status !== "void").length,
    openReceivables: state.receivables.filter((row) => row.status !== "paid" && row.status !== "writeoff").length,
    unresolvedRoExceptions: state.roExceptions.filter((row) => !row.resolved).length,
    pendingApprovals: state.approvals.filter((row) => row.status === "pending").length,
    openReconciliations: state.reconciliations.filter((row) => row.status === "open").length,
    openTaxFilings: state.taxFilings.filter((row) => row.status !== "filed").length,
    activeAssets: state.assets.filter((row) => row.status === "active").length,
  };
}
