import { kutmApi } from "../../lib/kutm";

type Page<T> = { items?: T[] };

type ServiceQueueItem = {
  ro_id: string;
  status?: string | null;
  customer_name?: string | null;
  vehicle?: string | null;
  updated_at?: string | null;
};

type ServiceDoc = {
  doc_id: string;
  document?: Record<string, unknown>;
  updated_at?: string | null;
};

export type ServiceRecord = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

export async function listServiceRecords(): Promise<ServiceRecord[]> {
  const response = await kutmApi.get<Page<ServiceQueueItem>>("/service/queue", { page: 1, size: 100 }, true);
  return (response.items ?? []).map((item) => ({
    id: item.ro_id,
    title: item.customer_name || item.vehicle || item.ro_id,
    status: item.status || "open",
    updatedAt: item.updated_at || "",
  }));
}

export async function getServiceRecord(id: string): Promise<ServiceRecord> {
  const response = await kutmApi.get<ServiceDoc>(`/service/ros/${id}`, undefined, true);
  const doc = response.document ?? {};
  return {
    id: response.doc_id,
    title: String(doc.customer_name ?? doc.vehicle ?? response.doc_id),
    status: String(doc.status ?? "open"),
    updatedAt: response.updated_at ?? "",
  };
}

export async function createServiceRecord(args: {
  roId: string;
  customerName?: string;
  vehicle?: string;
}): Promise<ServiceRecord> {
  await kutmApi.post("/service/ros", {
    ro_id: args.roId,
    customer_name: args.customerName || null,
    vehicle: args.vehicle || null,
  });
  return getServiceRecord(args.roId);
}

export async function appendServiceEvent(args: {
  roId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<ServiceRecord> {
  await kutmApi.post(`/service/ros/${args.roId}/events`, {
    event_type: args.eventType,
    payload: args.payload ?? {},
  });
  return getServiceRecord(args.roId);
}
