import { ApiError } from "../../lib/api";
import { kutmApi } from "../../lib/kutm";

export type ApprovalStatus = "Pending approval" | "Approved" | "Rejected" | "Needs follow-up";

export type ConversationMessage = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  request_id: string;
  type: "note" | "approval";
};

export type Conversation = {
  id: string;
  customerName: string;
  vehicle: string;
  status: ApprovalStatus;
  latestMessageAt: string;
  request_id: string;
  messages: ConversationMessage[];
};

export type ApprovalDecision = "request" | "approve" | "reject";

type ServiceQueueItem = {
  ro_id: string;
  status?: string | null;
  customer_name?: string | null;
  vehicle?: string | null;
  updated_at?: string | null;
};

type ServiceQueuePage = {
  items?: ServiceQueueItem[];
};

type ServiceDoc = {
  doc_id: string;
  document?: Record<string, unknown>;
  updated_at?: string | null;
};

function toApprovalStatus(rawStatus: string | null | undefined): ApprovalStatus {
  const status = (rawStatus || "").toLowerCase();
  if (status === "authorized" || status === "complete" || status === "closed") {
    return "Approved";
  }
  if (status === "declined" || status === "rejected") {
    return "Rejected";
  }
  if (status === "in_progress" || status === "checked_in") {
    return "Needs follow-up";
  }
  return "Pending approval";
}

function queueItemToConversation(item: ServiceQueueItem): Conversation {
  const requestId = `req-${item.ro_id}`;
  const latest = item.updated_at || new Date().toISOString();
  return {
    id: item.ro_id,
    customerName: item.customer_name || "Unknown customer",
    vehicle: item.vehicle || "Unknown vehicle",
    status: toApprovalStatus(item.status),
    latestMessageAt: latest,
    request_id: requestId,
    messages: [
      {
        id: `msg-${item.ro_id}-latest`,
        author: "System",
        body: `Current RO status: ${item.status || "open"}`,
        createdAt: latest,
        request_id: requestId,
        type: "note",
      },
    ],
  };
}

export async function listConversations(): Promise<Conversation[]> {
  const response = await kutmApi.get<ServiceQueuePage>("/service/queue", { page: 1, size: 100 }, true);
  return (response.items ?? []).map(queueItemToConversation);
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await kutmApi.get<ServiceDoc>(`/service/ros/${id}`, undefined, true);
  const doc = response.document ?? {};
  const latest = response.updated_at || new Date().toISOString();
  const requestId = `req-${id}`;
  return {
    id: response.doc_id,
    customerName: String(doc.customer_name ?? "Unknown customer"),
    vehicle: String(doc.vehicle ?? "Unknown vehicle"),
    status: toApprovalStatus(typeof doc.status === "string" ? doc.status : "open"),
    latestMessageAt: latest,
    request_id: requestId,
    messages: [
      {
        id: `msg-${id}-latest`,
        author: "System",
        body: `Current RO status: ${String(doc.status ?? "open")}`,
        createdAt: latest,
        request_id: requestId,
        type: "note",
      },
    ],
  };
}

export async function postApprovalDecision(
  conversationId: string,
  decision: ApprovalDecision,
): Promise<{ queued: boolean; request_id: string }> {
  const path = `/dms/comms/${conversationId}/approval`;
  try {
    const response = await kutmApi.post<{ queued?: boolean; request_id?: string }>(path, {
      decision,
      at: new Date().toISOString(),
    });
    return {
      queued: Boolean(response.queued),
      request_id: response.request_id ?? `req-${conversationId}`,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      return { queued: true, request_id: `req-local-${conversationId}` };
    }
    throw error;
  }
}
