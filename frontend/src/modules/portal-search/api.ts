import { kutmApi } from "../../lib/kutm";

export type PortalSearchModule = "customers" | "accounting";

export type PortalSearchItem = {
  module: PortalSearchModule;
  entityId: string;
  title: string;
  subtitle: string;
  status: string;
  updatedAt: string;
  url: string;
};

export type PortalSearchResult = {
  query: string;
  modules: string[];
  facets: {
    customers: number;
    accounting: number;
  };
  items: PortalSearchItem[];
};

const SAVED_SEARCHES_KEY = "kutm:portal-search:saved";

type PortalSearchResponse = {
  query: string;
  modules: string[];
  facets: {
    customers: number;
    accounting: number;
  };
  items: Array<{
    module: PortalSearchModule;
    entity_id: string;
    title: string;
    subtitle: string;
    status: string;
    updated_at: string;
    url: string;
  }>;
};

export async function searchPortal(
  query: string,
  options?: { modules?: PortalSearchModule[]; limit?: number },
): Promise<PortalSearchResult> {
  const modules = options?.modules ?? ["customers", "accounting"];
  const response = await kutmApi.get<PortalSearchResponse>(
    "/portal/search",
    {
      q: query.trim() || undefined,
      modules: modules.join(","),
      limit: options?.limit ?? 12,
    },
    true,
  );

  return {
    query: response.query,
    modules: response.modules,
    facets: response.facets,
    items: (response.items ?? []).map((item) => ({
      module: item.module,
      entityId: item.entity_id,
      title: item.title,
      subtitle: item.subtitle,
      status: item.status,
      updatedAt: item.updated_at,
      url: item.url,
    })),
  };
}

export function loadSavedPortalSearches(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 10);
  } catch {
    return [];
  }
}

export function savePortalSearchQuery(query: string): void {
  const normalized = query.trim();
  if (!normalized) return;
  const existing = loadSavedPortalSearches();
  const next = [normalized, ...existing.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 10);
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
}
