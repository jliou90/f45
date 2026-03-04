import { hasRoute } from "../../gen/openapi-endpoints";
import { ApiError } from "../../lib/api";
import { API_BASE_ORIGIN, kutmApi } from "../../lib/kutm";

export type WorkbenchResource = {
  name: string;
  listPath: string;
  detailPath: string;
  idParam: string;
  supportsUpdate: boolean;
  supportsDelete: boolean;
};

export type WorkbenchItem = {
  id: string;
  request_id?: string;
  [key: string]: unknown;
};

const FALLBACK_RESOURCE: WorkbenchResource = {
  name: "appointments",
  listPath: "/dms/appointments",
  detailPath: "/dms/appointments/{appointment_id}",
  idParam: "appointment_id",
  supportsUpdate: true,
  supportsDelete: true,
};

let discoveredResource: WorkbenchResource | null = null;
let discoveryError: string | null = null;

function runtimeEndpointReady(path: string, method: string): boolean {
  return hasRoute(path, method);
}

function normalizeId(item: Record<string, unknown>): string {
  const id = item.id ?? item.uuid ?? item.appointment_id ?? item.customer_id;
  return typeof id === "string" ? id : String(id ?? "");
}

function normalizeList(payload: unknown): WorkbenchItem[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        return { ...record, id: normalizeId(record) };
      })
      .filter((item): item is WorkbenchItem => Boolean(item?.id));
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const items = record.items;
    if (Array.isArray(items)) {
      return items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const nested = item as Record<string, unknown>;
          return { ...nested, id: normalizeId(nested) };
        })
        .filter((item): item is WorkbenchItem => Boolean(item?.id));
    }
  }

  return [];
}

function pathToClient(path: string): string {
  return path.replace(/^\/api\/v1/, "");
}

function findIdParam(path: string): string {
  const match = path.match(/\{([^}]+)\}/);
  return match ? match[1] : "id";
}

function resolveDetailPath(template: string, idParam: string, id: string): string {
  return pathToClient(template).replace(`{${idParam}}`, encodeURIComponent(id));
}

export async function discoverWorkbenchResource(force = false): Promise<WorkbenchResource> {
  if (discoveredResource && !force) {
    return discoveredResource;
  }

  if (!import.meta.env.DEV) {
    discoveredResource = FALLBACK_RESOURCE;
    return discoveredResource;
  }

  try {
    const response = await fetch(`${API_BASE_ORIGIN}/openapi.json`);
    if (!response.ok) {
      throw new Error(`openapi fetch failed (${response.status})`);
    }
    const doc = (await response.json()) as { paths?: Record<string, Record<string, unknown>> };
    const paths = doc.paths ?? {};

    const candidates = Object.entries(paths)
      .filter(([path, methods]) => path.startsWith("/api/v1/dms/") && methods.get && methods.post)
      .map(([listPath]) => {
        const detail = Object.keys(paths).find((candidate) => candidate.startsWith(`${listPath}/`) && candidate.includes("{") && paths[candidate]?.get);
        return { listPath, detailPath: detail ?? "" };
      })
      .filter((candidate) => Boolean(candidate.detailPath));

    if (candidates.length === 0) {
      throw new Error("No discoverable /api/v1/dms/* CRUD routes with GET+POST+detail GET");
    }

    const selected = candidates[0];
    const detailMethods = paths[selected.detailPath] ?? {};
    discoveredResource = {
      name: selected.listPath.split("/").at(-1) ?? "resource",
      listPath: pathToClient(selected.listPath),
      detailPath: selected.detailPath,
      idParam: findIdParam(selected.detailPath),
      supportsUpdate: Boolean(detailMethods.patch || detailMethods.put),
      supportsDelete: Boolean(detailMethods.delete),
    };
    discoveryError = null;
    return discoveredResource;
  } catch (error) {
    discoveryError = error instanceof Error ? error.message : String(error);
    discoveredResource = FALLBACK_RESOURCE;
    return discoveredResource;
  }
}

export function getDiscoveryMessage(): string | null {
  return discoveryError;
}

export async function listWorkbenchItems(input: { page: number; size: number; search: string }): Promise<WorkbenchItem[]> {
  const resource = await discoverWorkbenchResource();
  const listPath = resource.listPath;
  const path = runtimeEndpointReady(`/api/v1${listPath}`, "GET") ? listPath : FALLBACK_RESOURCE.listPath;
  const payload = await kutmApi.get<unknown>(path, {
    page: input.page,
    size: input.size,
    q: input.search || undefined,
  });
  return normalizeList(payload);
}

export async function getWorkbenchItem(id: string): Promise<WorkbenchItem> {
  const resource = await discoverWorkbenchResource();
  const detailTemplate = runtimeEndpointReady(resource.detailPath, "GET") ? resource.detailPath : FALLBACK_RESOURCE.detailPath;
  const detailPath = resolveDetailPath(detailTemplate, resource.idParam, id);
  const payload = await kutmApi.get<Record<string, unknown>>(detailPath, undefined, true);
  return {
    ...payload,
    id: normalizeId(payload),
  };
}

export async function createWorkbenchItem(body: Record<string, unknown>): Promise<WorkbenchItem> {
  const resource = await discoverWorkbenchResource();
  const path = runtimeEndpointReady(`/api/v1${resource.listPath}`, "POST") ? resource.listPath : FALLBACK_RESOURCE.listPath;

  try {
    const payload = await kutmApi.post<Record<string, unknown>>(path, body, true);
    return {
      ...payload,
      id: normalizeId(payload),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      return {
        id: `wb-local-${Date.now()}`,
        ...body,
        request_id: `req-local-${Date.now()}`,
      };
    }
    throw error;
  }
}

export async function updateWorkbenchItem(id: string, body: Record<string, unknown>): Promise<WorkbenchItem> {
  const resource = await discoverWorkbenchResource();
  const detailTemplate = runtimeEndpointReady(resource.detailPath, "PATCH") ? resource.detailPath : FALLBACK_RESOURCE.detailPath;
  const detailPath = resolveDetailPath(detailTemplate, resource.idParam, id);

  try {
    const payload = await kutmApi.patch<Record<string, unknown>>(detailPath, body, true);
    return {
      ...payload,
      id: normalizeId(payload) || id,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      return {
        id,
        ...body,
        request_id: `req-local-${Date.now()}`,
      };
    }
    throw error;
  }
}

export async function deleteWorkbenchItem(id: string): Promise<{ request_id?: string }> {
  const resource = await discoverWorkbenchResource();
  const detailTemplate = runtimeEndpointReady(resource.detailPath, "DELETE") ? resource.detailPath : FALLBACK_RESOURCE.detailPath;
  const detailPath = resolveDetailPath(detailTemplate, resource.idParam, id);
  try {
    return await kutmApi.delete<{ request_id?: string }>(detailPath, true);
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      return { request_id: `req-local-${Date.now()}` };
    }
    throw error;
  }
}
