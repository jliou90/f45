import { kutmApi } from "../../lib/kutm";

type Page<T> = { items?: T[] };

type DealQueueItem = {
  deal_id: string;
  state: string;
  customer_id?: string | null;
  vehicle_id?: string | null;
  updated_at?: string | null;
};

type DealDoc = {
  doc_id: string;
  document?: Record<string, unknown>;
  updated_at?: string | null;
};

export type SalesRecord = {
  id: string;
  title: string;
  state: string;
  updatedAt: string;
};

export async function listSalesRecords(): Promise<SalesRecord[]> {
  const response = await kutmApi.get<Page<DealQueueItem>>("/deals/queue/by-state", { page: 1, size: 100 }, true);
  return (response.items ?? []).map((item) => ({
    id: item.deal_id,
    title: item.customer_id || item.vehicle_id || item.deal_id,
    state: item.state,
    updatedAt: item.updated_at || "",
  }));
}

export async function getSalesRecord(id: string): Promise<SalesRecord> {
  const response = await kutmApi.get<DealDoc>(`/deals/${id}`, undefined, true);
  const doc = response.document ?? {};
  return {
    id: response.doc_id,
    title: String(doc.customer_id ?? doc.vehicle_id ?? response.doc_id),
    state: String(doc.state ?? "quote"),
    updatedAt: response.updated_at ?? "",
  };
}

export async function createSalesRecord(args: {
  dealId: string;
  customerId?: string;
  vehicleId?: string;
  quoteAmountCents?: number;
}): Promise<SalesRecord> {
  await kutmApi.post("/deals", {
    deal_id: args.dealId,
    customer_id: args.customerId || null,
    vehicle_id: args.vehicleId || null,
    quote_amount_cents: args.quoteAmountCents ?? 0,
  });
  return getSalesRecord(args.dealId);
}

export async function transitionSalesRecord(args: {
  dealId: string;
  toState: string;
  reason?: string;
}): Promise<SalesRecord> {
  await kutmApi.post(`/deals/${args.dealId}/transition`, {
    to_state: args.toState,
    reason: args.reason || null,
    payload: {},
  });
  return getSalesRecord(args.dealId);
}
