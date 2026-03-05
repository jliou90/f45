import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addJournalEntry,
  addReceivable,
  addReconciliation,
  addVendorInvoice,
  applyReceivablePayment,
  buildReferenceNumber,
  clearReconciliation,
  closePeriod,
  createAccountingRecord,
  emptyAccountingRecordInput,
  getAccountingOpsState,
  listAccountingRecords,
  summarizeAccountingOps,
  totalRecordAmount,
  updateAccountingRecord,
  type AccountingOpsState,
} from "../modules/accounting/api";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "test-rid" },
  });
}

describe("accounting api", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("kutm-shell:tenant_id", "tenant-1");
    sessionStorage.clear();
  });

  it("creates and updates workflow records through backend endpoints", async () => {
    const input = emptyAccountingRecordInput("po_sheet", "2026-03");
    input.title = "March PO";
    input.referenceNumber = buildReferenceNumber("po_sheet", "2026-03");
    input.lineItems = [{ id: "line-1", label: "Inventory", glCode: "5000", quantity: 2, unitAmount: 150 }];
    input.taxAmount = 12.5;
    input.commissionRate = 5;

    const fetchMock = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url;
      const method = init?.method ?? "GET";
      if (url.includes("/api/v1/acct/workflow-records") && method === "POST") {
        return mockResponse({
          ...input,
          id: "acct-1",
          tenantId: "tenant-1",
          createdAt: "2026-03-05T00:00:00Z",
          updatedAt: "2026-03-05T00:00:00Z",
        });
      }
      if (url.includes("/api/v1/acct/workflow-records/acct-1") && method === "PUT") {
        return mockResponse({
          ...input,
          status: "in_review",
          notes: "Supervisor review pending",
          id: "acct-1",
          tenantId: "tenant-1",
          createdAt: "2026-03-05T00:00:00Z",
          updatedAt: "2026-03-05T01:00:00Z",
        });
      }
      if (url.includes("/api/v1/acct/workflow-records?") && method === "GET") {
        return mockResponse({
          items: [
            {
              ...input,
              status: "in_review",
              notes: "Supervisor review pending",
              id: "acct-1",
              tenantId: "tenant-1",
              createdAt: "2026-03-05T00:00:00Z",
              updatedAt: "2026-03-05T01:00:00Z",
            },
          ],
        });
      }
      return mockResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const created = await createAccountingRecord(input);
    expect(created.id).toBe("acct-1");

    const updated = await updateAccountingRecord("acct-1", { ...input, status: "in_review", notes: "Supervisor review pending" });
    expect(updated.status).toBe("in_review");

    const rows = await listAccountingRecords();
    expect(rows).toHaveLength(1);
    expect(rows[0].notes).toBe("Supervisor review pending");
  });

  it("calculates full record total including tax and commission", async () => {
    const input = emptyAccountingRecordInput("commission_wash", "2026-04");
    input.referenceNumber = "COMM-TEST";
    input.title = "Commission Wash";
    input.lineItems = [
      { id: "line-1", label: "Front gross", glCode: "4100", quantity: 1, unitAmount: 1000 },
      { id: "line-2", label: "Back gross", glCode: "4200", quantity: 1, unitAmount: 500 },
    ];
    input.taxAmount = 75;
    input.commissionRate = 10;

    expect(totalRecordAmount({ ...input, id: "x", tenantId: "t", createdAt: "a", updatedAt: "b" })).toBe(1725);
  });

  it("mutates ops state via backend action endpoints", async () => {
    let state: AccountingOpsState = {
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

    const fetchMock = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url;
      const method = init?.method ?? "GET";
      if (url.includes("/api/v1/acct/ops/state") && method === "GET") {
        return mockResponse({ state, updated_at: "2026-03-05T00:00:00Z" });
      }
      if (url.includes("/api/v1/acct/ops/actions") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { action: string; payload: Record<string, unknown> };
        const now = "2026-03-05T00:01:00Z";
        if (body.action === "period.close") {
          state.periodControls.unshift({
            id: "period-1",
            periodId: String(body.payload.periodId ?? ""),
            lockDate: String(body.payload.lockDate ?? ""),
            status: body.payload.hardClose ? "hard_closed" : "soft_closed",
            closeNotes: String(body.payload.closeNotes ?? ""),
            updatedAt: now,
          });
          state.approvals.unshift({ id: "approval-1", area: "period_close", entityId: String(body.payload.periodId ?? ""), amount: 0, requestedBy: "accounting_user", status: "pending", updatedAt: now });
        }
        if (body.action === "journal.create") {
          state.journals.unshift({ id: "j-1", periodId: String(body.payload.periodId ?? ""), memo: String(body.payload.memo ?? ""), amount: Number(body.payload.amount ?? 0), entryDate: String(body.payload.entryDate ?? ""), status: "draft", updatedAt: now });
        }
        if (body.action === "ap.invoice.create") {
          state.vendorInvoices.unshift({ id: "inv-1", vendorName: String(body.payload.vendorName ?? ""), invoiceNo: String(body.payload.invoiceNo ?? ""), amount: Number(body.payload.amount ?? 0), dueDate: String(body.payload.dueDate ?? ""), status: "open", updatedAt: now });
        }
        if (body.action === "ar.create") {
          state.receivables.unshift({ id: "ar-1", customerName: String(body.payload.customerName ?? ""), amountDue: Number(body.payload.amountDue ?? 0), amountPaid: 0, dueDate: String(body.payload.dueDate ?? ""), status: "open", updatedAt: now });
        }
        if (body.action === "recon.create") {
          const statement = Number(body.payload.statementBalance ?? 0);
          const book = Number(body.payload.bookBalance ?? 0);
          state.reconciliations.unshift({ id: "recon-1", accountName: String(body.payload.accountName ?? ""), statementDate: String(body.payload.statementDate ?? ""), statementBalance: statement, bookBalance: book, difference: statement - book, status: "open", updatedAt: now });
        }
        if (body.action === "ar.payment") {
          const row = state.receivables[0];
          row.amountPaid = Math.min(row.amountDue, row.amountPaid + Number(body.payload.amount ?? 0));
          row.status = row.amountPaid >= row.amountDue ? "paid" : "partial";
          row.updatedAt = now;
        }
        if (body.action === "recon.clear") {
          const row = state.reconciliations[0];
          row.difference = 0;
          row.status = "cleared";
          row.updatedAt = now;
        }
        return mockResponse({ state, action: body.action, updated_at: now });
      }
      return mockResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await closePeriod("2026-03", "2026-03-31", "month end", true);
    await addJournalEntry({ periodId: "2026-03", memo: "Accrual", amount: 200, entryDate: "2026-03-31" });
    await addVendorInvoice({ vendorName: "Vendor", invoiceNo: "INV-1", amount: 500, dueDate: "2026-04-10" });
    await addReceivable({ customerName: "Customer", amountDue: 750, dueDate: "2026-04-11" });
    await addReconciliation({ accountName: "Main", statementDate: "2026-03-31", statementBalance: 1000, bookBalance: 900 });
    const receivable = (await getAccountingOpsState()).receivables[0];
    await applyReceivablePayment(receivable.id, 250);
    const recon = (await getAccountingOpsState()).reconciliations[0];
    await clearReconciliation(recon.id);

    const summary = summarizeAccountingOps(await getAccountingOpsState());
    expect(summary.openJournals).toBe(1);
    expect(summary.unpaidInvoices).toBe(1);
    expect(summary.openReceivables).toBe(1);
    expect(summary.openReconciliations).toBe(0);
    expect(summary.pendingApprovals).toBe(1);
  });
});
