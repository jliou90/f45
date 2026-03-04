import { isBrowserEnvironment, makeStorageKey } from "./environment";

export type ThemeMode = "light" | "dark" | "system";

type ScopedStringListMap = Record<string, string[]>;
type ScopedThemeMap = Record<string, ThemeMode>;

type RecentRouteOptions = {
  max?: number;
};

const FAVORITES_KEY = makeStorageKey("prefs.favorites");
const RECENT_ROUTES_KEY = makeStorageKey("prefs.recentRoutes");
const THEME_KEY = makeStorageKey("prefs.theme");
const LAST_ROUTE_KEY = makeStorageKey("prefs.lastRoute");
const DEFAULT_SCOPE = "__default";

function safeStorage(): Storage | null {
  return isBrowserEnvironment() ? window.localStorage : null;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function scopeForUser(userKey?: string | null): string {
  const value = (userKey ?? "").trim().toLowerCase();
  return value.length > 0 ? value : DEFAULT_SCOPE;
}

function getScopedList(storageKey: string, userKey?: string | null): string[] {
  const data = safeParse<ScopedStringListMap>(safeStorage()?.getItem(storageKey) ?? null, {});
  const scoped = data[scopeForUser(userKey)];
  return Array.isArray(scoped) ? scoped.filter((item) => typeof item === "string") : [];
}

function setScopedList(storageKey: string, values: string[], userKey?: string | null): void {
  const storage = safeStorage();
  if (!storage) return;
  const normalized = Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  const data = safeParse<ScopedStringListMap>(storage.getItem(storageKey), {});
  data[scopeForUser(userKey)] = normalized;
  storage.setItem(storageKey, JSON.stringify(data));
}

export function getFavorites(userKey?: string | null): string[] {
  return getScopedList(FAVORITES_KEY, userKey);
}

export function setFavorites(values: string[], userKey?: string | null): void {
  setScopedList(FAVORITES_KEY, values, userKey);
}

export function toggleFavorite(value: string, userKey?: string | null): string[] {
  const current = getFavorites(userKey);
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  setFavorites(next, userKey);
  return next;
}

export function getRecentRoutes(userKey?: string | null): string[] {
  return getScopedList(RECENT_ROUTES_KEY, userKey);
}

export function addRecentRoute(route: string, userKey?: string | null, options?: RecentRouteOptions): string[] {
  const cleanRoute = route.trim();
  if (!cleanRoute || cleanRoute === "/login") {
    return getRecentRoutes(userKey);
  }
  const max = options?.max ?? 10;
  const current = getRecentRoutes(userKey);
  const next = [cleanRoute, ...current.filter((item) => item !== cleanRoute)].slice(0, max);
  setScopedList(RECENT_ROUTES_KEY, next, userKey);
  return next;
}

export function getLastRoute(userKey?: string | null): string | null {
  const data = safeParse<Record<string, string | null>>(safeStorage()?.getItem(LAST_ROUTE_KEY) ?? null, {});
  const scoped = data[scopeForUser(userKey)];
  return typeof scoped === "string" && scoped.length > 0 ? scoped : null;
}

export function setLastRoute(route: string, userKey?: string | null): void {
  const storage = safeStorage();
  if (!storage) return;
  const cleanRoute = route.trim();
  if (!cleanRoute || cleanRoute === "/login") return;
  const data = safeParse<Record<string, string | null>>(storage.getItem(LAST_ROUTE_KEY), {});
  data[scopeForUser(userKey)] = cleanRoute;
  storage.setItem(LAST_ROUTE_KEY, JSON.stringify(data));
}

export function getThemeMode(userKey?: string | null): ThemeMode {
  const data = safeParse<ScopedThemeMap>(safeStorage()?.getItem(THEME_KEY) ?? null, {});
  const value = data[scopeForUser(userKey)];
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function setThemeMode(mode: ThemeMode, userKey?: string | null): void {
  const storage = safeStorage();
  if (!storage) return;
  const data = safeParse<ScopedThemeMap>(storage.getItem(THEME_KEY), {});
  data[scopeForUser(userKey)] = mode;
  storage.setItem(THEME_KEY, JSON.stringify(data));
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") {
    return mode;
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function applyTheme(mode: ThemeMode): "light" | "dark" {
  const resolved = resolveTheme(mode);
  if (typeof document !== "undefined") {
    document.body.classList.toggle("theme-dark", resolved === "dark");
  }
  return resolved;
}
