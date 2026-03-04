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

export type OutboundCommunication = {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  customer_id?: string | null;
  deal_id?: string | null;
  channel: string;
  to_address: string;
  subject: string;
  body: string;
  status: string;
  provider_message_id?: string | null;
  error?: string | null;
  attachment_id?: string | null;
  created_at: string;
  updated_at: string;
};

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

type OutboundPage = {
  items?: OutboundCommunication[];
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

export async function uploadCommsAttachment(file: File): Promise<{ id: string; filename: string; mime_type: string }> {
  const form = new FormData();
  form.append("file", file);
  return kutmApi.post<{ id: string; filename: string; mime_type: string }>("/docs/attachments/upload", form);
}

export async function sendCustomerEmail(input: {
  customerId: string;
  toEmail: string;
  subject: string;
  body: string;
  attachmentId?: string;
}): Promise<OutboundCommunication> {
  return kutmApi.post<OutboundCommunication>(`/comms/customers/${encodeURIComponent(input.customerId)}/email`, {
    to_email: input.toEmail,
    subject: input.subject,
    body: input.body,
    attachment_id: input.attachmentId || null,
  });
}

export async function listCustomerEmails(customerId: string): Promise<OutboundCommunication[]> {
  const response = await kutmApi.get<OutboundPage>(`/comms/customers/${encodeURIComponent(customerId)}`, { page: 1, size: 100 });
  return response.items ?? [];
}

export async function sendFundingStip(input: {
  dealId: string;
  lenderEmail: string;
  stipName: string;
  attachmentId: string;
  subject?: string;
  note?: string;
}): Promise<OutboundCommunication> {
  return kutmApi.post<OutboundCommunication>(`/comms/funding/${encodeURIComponent(input.dealId)}/stip`, {
    lender_email: input.lenderEmail,
    stip_name: input.stipName,
    attachment_id: input.attachmentId,
    subject: input.subject || null,
    note: input.note || null,
  });
}
