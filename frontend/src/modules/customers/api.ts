import { ApiError } from "../../lib/api";
import { kutmApi } from "../../lib/kutm";

type Page<T> = { items?: T[] };
type PageMeta = { page: number; size: number; total: number };
type PageWithMeta<T> = { items?: T[]; meta?: PageMeta };
type DealQueueItem = { deal_id: string; customer_id?: string | null; state?: string | null; updated_at?: string | null };
type ServiceQueueItem = { ro_id: string; customer_name?: string | null; status?: string | null; updated_at?: string | null };

type CustomerCore = {
  id: string;
  tenant_id: string;
  version: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type CustomerSpousePayload = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  notes: string;
};

type CustomerHouseholdPayload = {
  household_id: string;
  relationship: string;
  linked_customer_ids: string[];
};

type CustomerPhonePayload = {
  id: string;
  label: string;
  number: string;
  primary: boolean;
};

type CustomerEmailPayload = {
  id: string;
  label: string;
  email: string;
  primary: boolean;
};

type CustomerGaragePayload = {
  id: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  nickname: string;
};

type CustomerNotePayload = {
  id: string;
  text: string;
  created_at: string;
};

type CustomerCommunicationPayload = {
  id: string;
  channel: string;
  direction: string;
  subject: string;
  summary: string;
  happened_at: string;
};

type CustomerCrmProfile = {
  id: string;
  tenant_id: string;
  customer_id: string;
  version: number;
  dms_customer_id: string;
  spouse: CustomerSpousePayload;
  household: CustomerHouseholdPayload;
  phones: CustomerPhonePayload[];
  emails: CustomerEmailPayload[];
  garage: CustomerGaragePayload[];
  notes: CustomerNotePayload[];
  communications: CustomerCommunicationPayload[];
  tasks?: CustomerTaskPayload[];
  attachments?: CustomerAttachmentPayload[];
};

type CustomerTaskPayload = {
  id: string;
  title: string;
  due_at: string | null;
  status: string;
  owner: string;
  notes: string;
};

type CustomerAttachmentPayload = {
  attachment_id: string;
  filename: string;
  mime_type: string;
  size: number;
  linked_at: string;
};

type AuditEventOut = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id?: string | null;
  ts: string;
  metadata_json?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

type AttachmentOut = {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
};

type AttachmentLinkOut = {
  id: string;
  attachment_id: string;
  entity_type: string;
  entity_id: string;
};

export type ContactPhone = {
  id: string;
  label: string;
  number: string;
  primary: boolean;
};

export type ContactEmail = {
  id: string;
  label: string;
  email: string;
  primary: boolean;
};

export type CommunicationEntry = {
  id: string;
  channel: "phone" | "email" | "sms" | "in_person" | "other";
  direction: "inbound" | "outbound";
  subject: string;
  summary: string;
  happenedAt: string;
};

export type CustomerNote = {
  id: string;
  text: string;
  createdAt: string;
};

export type GarageVehicle = {
  id: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  nickname: string;
};

export type SpouseInfo = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
};

export type HouseholdInfo = {
  householdId: string;
  relationship: string;
  linkedCustomerIds: string[];
};

export type CustomerTask = {
  id: string;
  title: string;
  dueAt: string;
  status: "open" | "done" | "cancelled";
  owner: string;
  notes: string;
};

export type CustomerAttachment = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  linkedAt: string;
};

export type CustomerAuditEntry = {
  id: string;
  action: string;
  actorId: string;
  happenedAt: string;
  changedSections: string[];
};

export type CustomerTimelineEntry = {
  id: string;
  type: "note" | "communication" | "task" | "audit";
  title: string;
  detail: string;
  happenedAt: string;
};

export type CustomerExtension = {
  dmsCustomerId: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  spouse: SpouseInfo;
  household: HouseholdInfo;
  garage: GarageVehicle[];
  notes: CustomerNote[];
  communications: CommunicationEntry[];
  tasks: CustomerTask[];
  attachments: CustomerAttachment[];
};

export type CustomerProfile = {
  id: string;
  tenantId: string;
  version: number;
  crmVersion: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
} & CustomerExtension;

export type CustomerProfileInput = Omit<CustomerProfile, "id" | "tenantId" | "version" | "crmVersion">;

export type CustomerSummary = {
  id: string;
  dmsCustomerId: string;
  name: string;
  primaryPhone: string;
  primaryEmail: string;
  householdId: string;
  garageCount: number;
  notesCount: number;
  lastCommunicationAt: string;
};

export type CustomerSummaryPage = {
  items: CustomerSummary[];
  page: number;
  size: number;
  total: number;
};

export type MergePreview = {
  target: CustomerProfile;
  source: CustomerProfile;
};

export type CustomerLinkedWork = {
  openDeals: Array<{ id: string; state: string; updatedAt: string }>;
  openService: Array<{ id: string; status: string; updatedAt: string }>;
};

export type CustomerTaskAlert = {
  customerId: string;
  dmsCustomerId: string;
  customerName: string;
  taskId: string;
  title: string;
  dueAt: string;
  owner: string;
  status: string;
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankExtension(): CustomerExtension {
  return {
    dmsCustomerId: "",
    phones: [],
    emails: [],
    spouse: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      notes: "",
    },
    household: {
      householdId: "",
      relationship: "",
      linkedCustomerIds: [],
    },
    garage: [],
    notes: [],
    communications: [],
    tasks: [],
    attachments: [],
  };
}

function extensionFromPayload(payload?: CustomerCrmProfile | null): CustomerExtension {
  if (!payload) return blankExtension();
  return {
    dmsCustomerId: payload.dms_customer_id || "",
    phones: (payload.phones ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      number: item.number,
      primary: item.primary,
    })),
    emails: (payload.emails ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      email: item.email,
      primary: item.primary,
    })),
    spouse: {
      firstName: payload.spouse?.first_name || "",
      lastName: payload.spouse?.last_name || "",
      phone: payload.spouse?.phone || "",
      email: payload.spouse?.email || "",
      notes: payload.spouse?.notes || "",
    },
    household: {
      householdId: payload.household?.household_id || "",
      relationship: payload.household?.relationship || "",
      linkedCustomerIds: payload.household?.linked_customer_ids ?? [],
    },
    garage: (payload.garage ?? []).map((item) => ({
      id: item.id,
      year: item.year,
      make: item.make,
      model: item.model,
      vin: item.vin,
      nickname: item.nickname,
    })),
    notes: (payload.notes ?? []).map((item) => ({
      id: item.id,
      text: item.text,
      createdAt: item.created_at,
    })),
    communications: (payload.communications ?? []).map((item) => ({
      id: item.id,
      channel: (item.channel || "other") as CommunicationEntry["channel"],
      direction: (item.direction || "outbound") as CommunicationEntry["direction"],
      subject: item.subject,
      summary: item.summary,
      happenedAt: item.happened_at,
    })),
    tasks: (payload.tasks ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      dueAt: item.due_at ?? "",
      status: (item.status || "open") as CustomerTask["status"],
      owner: item.owner || "",
      notes: item.notes || "",
    })),
    attachments: (payload.attachments ?? []).map((item) => ({
      attachmentId: item.attachment_id,
      filename: item.filename,
      mimeType: item.mime_type,
      size: item.size,
      linkedAt: item.linked_at,
    })),
  };
}

function extensionToPayload(input: CustomerProfileInput): Omit<CustomerCrmProfile, "id" | "tenant_id" | "customer_id" | "version"> {
  return {
    dms_customer_id: input.dmsCustomerId,
    spouse: {
      first_name: input.spouse.firstName,
      last_name: input.spouse.lastName,
      phone: input.spouse.phone,
      email: input.spouse.email,
      notes: input.spouse.notes,
    },
    household: {
      household_id: input.household.householdId,
      relationship: input.household.relationship,
      linked_customer_ids: input.household.linkedCustomerIds.filter((id) => id.trim().length > 0),
    },
    phones: input.phones,
    emails: input.emails,
    garage: input.garage,
    notes: input.notes
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({ id: item.id, text: item.text, created_at: item.createdAt })),
    communications: input.communications
      .slice()
      .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))
      .map((item) => ({
        id: item.id,
        channel: item.channel,
        direction: item.direction,
        subject: item.subject,
        summary: item.summary,
        happened_at: item.happenedAt,
      })),
    tasks: input.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      due_at: task.dueAt || null,
      status: task.status,
      owner: task.owner,
      notes: task.notes,
    })),
    attachments: input.attachments.map((attachment) => ({
      attachment_id: attachment.attachmentId,
      filename: attachment.filename,
      mime_type: attachment.mimeType,
      size: attachment.size,
      linked_at: attachment.linkedAt,
    })),
  };
}

function mergeProfile(core: CustomerCore, crm?: CustomerCrmProfile | null): CustomerProfile {
  const extension = extensionFromPayload(crm);
  const phones = extension.phones.length > 0 ? extension.phones : core.phone ? [{ id: uid("phone"), label: "Primary", number: core.phone, primary: true }] : [];
  const emails = extension.emails.length > 0 ? extension.emails : core.email ? [{ id: uid("email"), label: "Primary", email: core.email, primary: true }] : [];

  return {
    id: core.id,
    tenantId: core.tenant_id,
    version: core.version,
    crmVersion: crm?.version ?? null,
    firstName: core.first_name,
    lastName: core.last_name,
    email: core.email ?? "",
    phone: core.phone ?? "",
    address1: core.address1 ?? "",
    address2: core.address2 ?? "",
    city: core.city ?? "",
    state: core.state ?? "",
    zip: core.zip ?? "",
    ...extension,
    phones,
    emails,
  };
}

async function getCrmProfile(customerId: string): Promise<CustomerCrmProfile | null> {
  try {
    return await kutmApi.get<CustomerCrmProfile>(`/dms/customers/${encodeURIComponent(customerId)}/crm`, undefined, true);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function saveCrmProfile(customerId: string, input: CustomerProfileInput, version?: number | null): Promise<CustomerCrmProfile> {
  const headers: Record<string, string> = {};
  if (typeof version === "number") {
    headers["If-Match"] = `"${version}"`;
  }
  return kutmApi.request<CustomerCrmProfile>("PUT", `/dms/customers/${encodeURIComponent(customerId)}/crm`, {
    body: extensionToPayload(input),
    headers,
    withTenant: true,
  });
}

export function createDmsCustomerId(lastName = ""): string {
  const normalized = lastName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CUST-${normalized || "GEN"}-${stamp}-${random}`;
}

export async function listCustomerSummaries(search = ""): Promise<CustomerSummary[]> {
  const pageSize = 200;
  const maxPages = 10;
  const all: CustomerSummary[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const current = await searchCustomerSummaries(search, { page, size: pageSize });
    all.push(...current.items);
    if (current.items.length < pageSize || current.page * current.size >= current.total) {
      break;
    }
  }
  return all;
}

export async function listCustomerTaskAlerts(limit = 50): Promise<CustomerTaskAlert[]> {
  const response = await kutmApi.get<PageWithMeta<CustomerCrmProfile>>(
    "/dms/customers-crm",
    {
      page: 1,
      size: 200,
    },
    true,
  );
  const profiles = response.items ?? [];
  const customerIds = profiles.map((row) => row.customer_id);
  const customerMap = new Map<string, CustomerCore>();
  if (customerIds.length > 0) {
    const customers = await Promise.all(
      customerIds.map((customerId) =>
        kutmApi
          .get<CustomerCore>(`/dms/customers/${encodeURIComponent(customerId)}`, undefined, true)
          .catch(() => null),
      ),
    );
    for (const customer of customers) {
      if (customer) {
        customerMap.set(customer.id, customer);
      }
    }
  }

  const alerts: CustomerTaskAlert[] = [];
  for (const profile of profiles) {
    const customer = customerMap.get(profile.customer_id);
    for (const task of profile.tasks ?? []) {
      if ((task.status || "open") === "done") continue;
      alerts.push({
        customerId: profile.customer_id,
        dmsCustomerId: profile.dms_customer_id || "",
        customerName: customer ? `${customer.first_name} ${customer.last_name}`.trim() : profile.customer_id,
        taskId: task.id,
        title: task.title || "Task",
        dueAt: task.due_at ?? "",
        owner: task.owner || "",
        status: task.status || "open",
      });
    }
  }

  return alerts
    .sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return a.customerName.localeCompare(b.customerName);
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    })
    .slice(0, limit);
}

export async function searchCustomerSummaries(
  search = "",
  opts?: { page?: number; size?: number },
): Promise<CustomerSummaryPage> {
  const page = opts?.page ?? 1;
  const size = opts?.size ?? 50;
  const response = await kutmApi.get<
    PageWithMeta<{
      id: string;
      dms_customer_id: string;
      name: string;
      primary_phone: string;
      primary_email: string;
      household_id: string;
      garage_count: number;
      notes_count: number;
      last_communication_at: string;
    }>
  >(
    "/dms/customers/search",
    {
      q: search.trim() || undefined,
      page,
      size,
    },
    true,
  );

  return {
    items: (response.items ?? []).map((row) => ({
      id: row.id,
      dmsCustomerId: row.dms_customer_id || "",
      name: row.name || "",
      primaryPhone: row.primary_phone || "",
      primaryEmail: row.primary_email || "",
      householdId: row.household_id || "",
      garageCount: row.garage_count || 0,
      notesCount: row.notes_count || 0,
      lastCommunicationAt: row.last_communication_at || "",
    })),
    page: response.meta?.page ?? page,
    size: response.meta?.size ?? size,
    total: response.meta?.total ?? 0,
  };
}

export async function getCustomerProfile(customerId: string): Promise<CustomerProfile> {
  const [core, crm] = await Promise.all([
    kutmApi.get<CustomerCore>(`/dms/customers/${encodeURIComponent(customerId)}`, undefined, true),
    getCrmProfile(customerId),
  ]);
  return mergeProfile(core, crm);
}

export async function createCustomerProfile(input: CustomerProfileInput): Promise<CustomerProfile> {
  const created = await kutmApi.post<CustomerCore>("/dms/customers", {
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email || input.emails.find((entry) => entry.primary)?.email || input.emails[0]?.email || null,
    phone: input.phone || input.phones.find((entry) => entry.primary)?.number || input.phones[0]?.number || null,
    address1: input.address1 || null,
    address2: input.address2 || null,
    city: input.city || null,
    state: input.state || null,
    zip: input.zip || null,
  });

  const crm = await saveCrmProfile(created.id, input, null);
  return mergeProfile(created, crm);
}

export async function updateCustomerProfile(customerId: string, input: CustomerProfileInput, versions?: { customerVersion?: number; crmVersion?: number | null }): Promise<CustomerProfile> {
  const customerHeaders: Record<string, string> = {};
  if (typeof versions?.customerVersion === "number") {
    customerHeaders["If-Match"] = `"${versions.customerVersion}"`;
  }

  const updatedCore = await kutmApi.request<CustomerCore>("PUT", `/dms/customers/${encodeURIComponent(customerId)}`, {
    body: {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email || input.emails.find((entry) => entry.primary)?.email || input.emails[0]?.email || null,
      phone: input.phone || input.phones.find((entry) => entry.primary)?.number || input.phones[0]?.number || null,
      address1: input.address1 || null,
      address2: input.address2 || null,
      city: input.city || null,
      state: input.state || null,
      zip: input.zip || null,
    },
    headers: customerHeaders,
    withTenant: true,
  });

  const crm = await saveCrmProfile(customerId, input, versions?.crmVersion ?? null);
  return mergeProfile(updatedCore, crm);
}

export async function listCustomerAuditEntries(customerId: string): Promise<CustomerAuditEntry[]> {
  const response = await kutmApi.get<Page<AuditEventOut>>(
    "/audit/events",
    { page: 1, size: 100, entity_type: "customer", entity_id: customerId, sort: "-ts" },
    true,
  );
  return (response.items ?? []).map((item) => ({
    id: item.id,
    action: item.action,
    actorId: item.actor_id || "unknown",
    happenedAt: item.ts,
    changedSections: (item.metadata_json?.changed_sections as string[] | undefined) ?? (item.metadata_json?.changed_fields as string[] | undefined) ?? [],
  }));
}

export function buildTimeline(profile: CustomerProfile, audits: CustomerAuditEntry[]): CustomerTimelineEntry[] {
  const notes: CustomerTimelineEntry[] = profile.notes.map((note) => ({
    id: note.id,
    type: "note",
    title: "Note",
    detail: note.text,
    happenedAt: note.createdAt,
  }));
  const comms: CustomerTimelineEntry[] = profile.communications.map((entry) => ({
    id: entry.id,
    type: "communication",
    title: `${entry.direction} ${entry.channel}`,
    detail: `${entry.subject} ${entry.summary}`.trim(),
    happenedAt: entry.happenedAt,
  }));
  const tasks: CustomerTimelineEntry[] = profile.tasks.map((task) => ({
    id: task.id,
    type: "task",
    title: `Task: ${task.title}`,
    detail: `${task.status}${task.owner ? ` • ${task.owner}` : ""}`,
    happenedAt: task.dueAt || new Date().toISOString(),
  }));
  const auditRows: CustomerTimelineEntry[] = audits.map((entry) => ({
    id: entry.id,
    type: "audit",
    title: `Audit: ${entry.action}`,
    detail: entry.changedSections.length > 0 ? entry.changedSections.join(", ") : entry.actorId,
    happenedAt: entry.happenedAt,
  }));
  return [...notes, ...comms, ...tasks, ...auditRows].sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));
}

export async function uploadCustomerAttachment(customerId: string, file: File): Promise<CustomerAttachment> {
  const body = new FormData();
  body.append("file", file);
  const uploaded = await kutmApi.request<AttachmentOut>("POST", "/docs/attachments/upload", { body, withTenant: true });
  await kutmApi.post<AttachmentLinkOut>(`/docs/attachments/${encodeURIComponent(uploaded.id)}/links`, {
    entity_type: "customer",
    entity_id: customerId,
  });
  return {
    attachmentId: uploaded.id,
    filename: uploaded.filename,
    mimeType: uploaded.mime_type,
    size: uploaded.size,
    linkedAt: new Date().toISOString(),
  };
}

export function buildDuplicateCandidates(target: CustomerProfile, all: CustomerSummary[]): CustomerSummary[] {
  const phoneNeedle = (target.phone || target.phones[0]?.number || "").replace(/\D/g, "");
  const emailNeedle = (target.email || target.emails[0]?.email || "").toLowerCase();
  const nameNeedle = `${target.firstName} ${target.lastName}`.trim().toLowerCase();
  return all.filter((row) => {
    if (row.id === target.id) return false;
    const rowPhone = row.primaryPhone.replace(/\D/g, "");
    const rowEmail = row.primaryEmail.toLowerCase();
    const rowName = row.name.toLowerCase();
    return (phoneNeedle.length >= 7 && rowPhone && rowPhone.includes(phoneNeedle)) || (emailNeedle && rowEmail === emailNeedle) || (nameNeedle && rowName === nameNeedle);
  });
}

export async function mergeCustomers(preview: MergePreview): Promise<void> {
  const merged: CustomerProfileInput = {
    firstName: preview.target.firstName || preview.source.firstName,
    lastName: preview.target.lastName || preview.source.lastName,
    email: preview.target.email || preview.source.email,
    phone: preview.target.phone || preview.source.phone,
    address1: preview.target.address1 || preview.source.address1,
    address2: preview.target.address2 || preview.source.address2,
    city: preview.target.city || preview.source.city,
    state: preview.target.state || preview.source.state,
    zip: preview.target.zip || preview.source.zip,
    dmsCustomerId: preview.target.dmsCustomerId || preview.source.dmsCustomerId,
    phones: [...preview.target.phones, ...preview.source.phones.filter((x) => !preview.target.phones.some((y) => y.number === x.number))],
    emails: [...preview.target.emails, ...preview.source.emails.filter((x) => !preview.target.emails.some((y) => y.email === x.email))],
    spouse: preview.target.spouse.firstName || preview.target.spouse.lastName ? preview.target.spouse : preview.source.spouse,
    household: {
      householdId: preview.target.household.householdId || preview.source.household.householdId,
      relationship: preview.target.household.relationship || preview.source.household.relationship,
      linkedCustomerIds: [...new Set([...preview.target.household.linkedCustomerIds, ...preview.source.household.linkedCustomerIds])],
    },
    garage: [...preview.target.garage, ...preview.source.garage.filter((x) => !preview.target.garage.some((y) => y.vin && y.vin === x.vin))],
    notes: [...preview.target.notes, ...preview.source.notes],
    communications: [...preview.target.communications, ...preview.source.communications],
    tasks: [...preview.target.tasks, ...preview.source.tasks],
    attachments: [...preview.target.attachments, ...preview.source.attachments],
  };
  await updateCustomerProfile(preview.target.id, merged, {
    customerVersion: preview.target.version,
    crmVersion: preview.target.crmVersion,
  });
  await kutmApi.request("DELETE", `/dms/customers/${encodeURIComponent(preview.source.id)}`, {
    headers: { "If-Match": `"${preview.source.version}"` },
    withTenant: true,
  });
}

export async function listCustomerLinkedWork(profile: CustomerProfile): Promise<CustomerLinkedWork> {
  const [deals, service] = await Promise.all([
    kutmApi.get<Page<DealQueueItem>>("/deals/queue/by-state", { page: 1, size: 200 }, true),
    kutmApi.get<Page<ServiceQueueItem>>("/service/queue", { page: 1, size: 200 }, true),
  ]);
  const fullName = `${profile.firstName} ${profile.lastName}`.trim().toLowerCase();
  return {
    openDeals: (deals.items ?? [])
      .filter((item) => item.customer_id === profile.id)
      .map((item) => ({
        id: item.deal_id,
        state: item.state || "unknown",
        updatedAt: item.updated_at || "",
      })),
    openService: (service.items ?? [])
      .filter((item) => {
        const customerName = (item.customer_name || "").toLowerCase();
        return fullName.length > 0 && (customerName === fullName || customerName.includes(fullName));
      })
      .map((item) => ({
        id: item.ro_id,
        status: item.status || "open",
        updatedAt: item.updated_at || "",
      })),
  };
}

export function emptyCustomerInput(): CustomerProfileInput {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    dmsCustomerId: "",
    phones: [],
    emails: [],
    spouse: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      notes: "",
    },
    household: {
      householdId: "",
      relationship: "",
      linkedCustomerIds: [],
    },
    garage: [],
    notes: [],
    communications: [],
    tasks: [],
    attachments: [],
  };
}

export function noteDraft(text: string): CustomerNote {
  return {
    id: uid("note"),
    text,
    createdAt: new Date().toISOString(),
  };
}

export function communicationDraft(input: Omit<CommunicationEntry, "id">): CommunicationEntry {
  return {
    ...input,
    id: uid("comm"),
  };
}

export function rowId(prefix: string): string {
  return uid(prefix);
}
