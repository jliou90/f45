import { applyTheme, getThemeMode, setThemeMode, type ThemeMode } from "../../../lib/prefs";
import { publishWindowSync } from "../../../lib/window-sync";
import type { SettingsSection } from "../capabilities";

export type DensityMode = "comfortable" | "compact";
export type DefaultLanding = "launcher" | "last_app";

export type UserSettingsV1 = {
  profile: {
    displayName: string;
    avatarUrl: string;
  };
  preferences: {
    theme: ThemeMode;
    density: DensityMode;
    timezone: string;
    defaultLanding: DefaultLanding;
  };
  workspace: {
    pinnedApps: string[];
    recentHistoryEnabled: boolean;
  };
  notifications: {
    desktopEnabled: boolean;
    emailDigestEnabled: boolean;
  };
};

type SettingsEnvelopeV1 = {
  schemaVersion: 1;
  byUser: Record<string, UserSettingsV1>;
};

const SETTINGS_KEY = "kutm.settings.v1";
const DEFAULT_SCOPE = "__default";
const PERSIST_DEBOUNCE_MS = 300;

const DEFAULT_SETTINGS: UserSettingsV1 = {
  profile: {
    displayName: "",
    avatarUrl: "",
  },
  preferences: {
    theme: "system",
    density: "comfortable",
    timezone: "browser",
    defaultLanding: "launcher",
  },
  workspace: {
    pinnedApps: [],
    recentHistoryEnabled: true,
  },
  notifications: {
    desktopEnabled: false,
    emailDigestEnabled: false,
  },
};

export class SettingsPermissionError extends Error {
  readonly name = "SettingsPermissionError";
  readonly code = "SETTINGS_WRITE_FORBIDDEN";
  readonly section: SettingsSection;
  readonly requiredPermission: string;

  constructor(section: SettingsSection, requiredPermission: string) {
    super(`Write denied for section "${section}". Missing permission "${requiredPermission}".`);
    this.section = section;
    this.requiredPermission = requiredPermission;
  }
}

type WriteAccess = {
  canWriteSection: (section: SettingsSection) => boolean;
  getWritePermissionForSection: (section: SettingsSection) => string | null;
};

type ReadAccess = {
  canReadSection: (section: SettingsSection) => boolean;
};

export class SettingsReadPermissionError extends Error {
  readonly name = "SettingsReadPermissionError";
  readonly code = "SETTINGS_READ_FORBIDDEN";
  readonly section: SettingsSection;
  readonly requiredPermission: string;

  constructor(section: SettingsSection, requiredPermission: string) {
    super(`Read denied for section "${section}". Missing permission "${requiredPermission}".`);
    this.section = section;
    this.requiredPermission = requiredPermission;
  }
}

type PendingPersistState = {
  timer: number | null;
  lastSerialized: string;
  nextEnvelope: SettingsEnvelopeV1 | null;
};

const pendingPersist: PendingPersistState = {
  timer: null,
  lastSerialized: "",
  nextEnvelope: null,
};

function getUserScope(userKey?: string | null): string {
  const normalized = (userKey ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : DEFAULT_SCOPE;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function sanitizeTheme(value: unknown, fallback: ThemeMode): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : fallback;
}

function sanitizeDensity(value: unknown, fallback: DensityMode): DensityMode {
  return value === "comfortable" || value === "compact" ? value : fallback;
}

function sanitizeDefaultLanding(value: unknown, fallback: DefaultLanding): DefaultLanding {
  return value === "launcher" || value === "last_app" ? value : fallback;
}

function sanitizeSettings(raw: unknown): UserSettingsV1 {
  const source = typeof raw === "object" && raw !== null ? (raw as Partial<UserSettingsV1>) : {};
  return {
    profile: {
      displayName: typeof source.profile?.displayName === "string" ? source.profile.displayName : DEFAULT_SETTINGS.profile.displayName,
      avatarUrl: typeof source.profile?.avatarUrl === "string" ? source.profile.avatarUrl : DEFAULT_SETTINGS.profile.avatarUrl,
    },
    preferences: {
      theme: sanitizeTheme(source.preferences?.theme, DEFAULT_SETTINGS.preferences.theme),
      density: sanitizeDensity(source.preferences?.density, DEFAULT_SETTINGS.preferences.density),
      timezone: typeof source.preferences?.timezone === "string" ? source.preferences.timezone : DEFAULT_SETTINGS.preferences.timezone,
      defaultLanding: sanitizeDefaultLanding(source.preferences?.defaultLanding, DEFAULT_SETTINGS.preferences.defaultLanding),
    },
    workspace: {
      pinnedApps: sanitizeStringList(source.workspace?.pinnedApps),
      recentHistoryEnabled:
        typeof source.workspace?.recentHistoryEnabled === "boolean"
          ? source.workspace.recentHistoryEnabled
          : DEFAULT_SETTINGS.workspace.recentHistoryEnabled,
    },
    notifications: {
      desktopEnabled: Boolean(source.notifications?.desktopEnabled),
      emailDigestEnabled: Boolean(source.notifications?.emailDigestEnabled),
    },
  };
}

export function migrateSettings(raw: unknown): SettingsEnvelopeV1 {
  const source = typeof raw === "object" && raw !== null ? (raw as Partial<SettingsEnvelopeV1>) : {};
  if (source.schemaVersion === 1 && source.byUser && typeof source.byUser === "object") {
    const byUser: Record<string, UserSettingsV1> = {};
    for (const [key, value] of Object.entries(source.byUser)) {
      byUser[key] = sanitizeSettings(value);
    }
    return { schemaVersion: 1, byUser };
  }

  const fallback = sanitizeSettings(source);
  return {
    schemaVersion: 1,
    byUser: {
      [DEFAULT_SCOPE]: fallback,
    },
  };
}

function loadEnvelope(): SettingsEnvelopeV1 {
  if (typeof window === "undefined") {
    return { schemaVersion: 1, byUser: {} };
  }
  const raw = parseJson<unknown>(window.localStorage.getItem(SETTINGS_KEY), null);
  return migrateSettings(raw);
}

function saveEnvelopeNow(envelope: SettingsEnvelopeV1): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(envelope));
}

function scheduleSaveEnvelope(envelope: SettingsEnvelopeV1): void {
  if (typeof window === "undefined") return;
  pendingPersist.nextEnvelope = envelope;
  if (pendingPersist.timer !== null) {
    window.clearTimeout(pendingPersist.timer);
  }
  pendingPersist.timer = window.setTimeout(() => {
    const queued = pendingPersist.nextEnvelope;
    pendingPersist.timer = null;
    pendingPersist.nextEnvelope = null;
    if (!queued) return;
    const serialized = JSON.stringify(queued);
    if (serialized === pendingPersist.lastSerialized) {
      return;
    }
    pendingPersist.lastSerialized = serialized;
    saveEnvelopeNow(queued);
  }, PERSIST_DEBOUNCE_MS);
}

function mergeSettings(current: UserSettingsV1, partial: Partial<UserSettingsV1>): UserSettingsV1 {
  return sanitizeSettings({
    profile: {
      ...current.profile,
      ...partial.profile,
    },
    preferences: {
      ...current.preferences,
      ...partial.preferences,
    },
    workspace: {
      ...current.workspace,
      ...partial.workspace,
    },
    notifications: {
      ...current.notifications,
      ...partial.notifications,
    },
  });
}

function diffSections(current: UserSettingsV1, next: UserSettingsV1): SettingsSection[] {
  const sections: SettingsSection[] = [];
  if (JSON.stringify(current.profile) !== JSON.stringify(next.profile)) sections.push("profile");
  if (JSON.stringify(current.preferences) !== JSON.stringify(next.preferences)) sections.push("preferences");
  if (JSON.stringify(current.workspace) !== JSON.stringify(next.workspace)) sections.push("workspace");
  if (JSON.stringify(current.notifications) !== JSON.stringify(next.notifications)) sections.push("notifications");
  return sections;
}

function getWritePermissionForSection(section: SettingsSection): string | null {
  if (section === "profile") return "settings.profile.write";
  if (section === "preferences") return "settings.preferences.write";
  if (section === "workspace") return "settings.workspace.write";
  if (section === "notifications") return "settings.notifications.write";
  return null;
}

function getReadPermissionForSection(section: SettingsSection): string | null {
  if (section === "profile") return "settings.profile.read";
  if (section === "preferences") return "settings.preferences.read";
  if (section === "workspace") return "settings.workspace.read";
  if (section === "notifications") return "settings.notifications.read";
  if (section === "sessions") return "settings.sessions.read";
  if (section === "shortcuts" || section === "access") return "settings.access";
  return null;
}

export function readSettings(userKey?: string | null, access?: ReadAccess, section?: SettingsSection): UserSettingsV1 {
  if (access && section && !access.canReadSection(section)) {
    throw new SettingsReadPermissionError(section, getReadPermissionForSection(section) ?? "unknown");
  }
  const scope = getUserScope(userKey);
  const envelope = loadEnvelope();
  const settings = envelope.byUser[scope] ?? DEFAULT_SETTINGS;
  return sanitizeSettings({
    ...settings,
    preferences: {
      ...settings.preferences,
      theme: getThemeMode(userKey),
    },
  });
}

export function writeSettings(
  partial: Partial<UserSettingsV1>,
  userKey: string | null | undefined,
  access: WriteAccess,
): UserSettingsV1 {
  const scope = getUserScope(userKey);
  const envelope = loadEnvelope();
  const current = sanitizeSettings(envelope.byUser[scope] ?? DEFAULT_SETTINGS);
  const next = mergeSettings(current, partial);
  const touched = diffSections(current, next);

  for (const section of touched) {
    if (!access.canWriteSection(section)) {
      throw new SettingsPermissionError(section, access.getWritePermissionForSection(section) ?? "unknown");
    }
  }

  if (touched.length === 0) {
    return current;
  }

  envelope.byUser[scope] = next;
  scheduleSaveEnvelope(envelope);
  return next;
}

export function getUserSettings(userKey?: string | null): UserSettingsV1 {
  return readSettings(userKey);
}

export function updateUserSettings(next: UserSettingsV1, userKey?: string | null): UserSettingsV1 {
  const merged = mergeSettings(readSettings(userKey), next);
  const envelope = loadEnvelope();
  envelope.byUser[getUserScope(userKey)] = merged;
  scheduleSaveEnvelope(envelope);
  return merged;
}

export function patchUserSettings(
  patch: (current: UserSettingsV1) => UserSettingsV1,
  userKey?: string | null,
): UserSettingsV1 {
  const current = getUserSettings(userKey);
  const next = patch(current);
  return updateUserSettings(next, userKey);
}

export function applyDensityMode(mode: DensityMode): void {
  if (typeof document === "undefined") return;
  document.body.dataset.density = mode;
}

export function applyUserAppearance(settings: UserSettingsV1, userKey?: string | null): void {
  setThemeMode(settings.preferences.theme, userKey);
  applyTheme(settings.preferences.theme);
  publishWindowSync({ type: "THEME_CHANGED", payload: { mode: settings.preferences.theme } });
  applyDensityMode(settings.preferences.density);
}

export function resolveDefaultLandingRoute(userKey?: string | null, lastRoute?: string | null): string {
  const settings = readSettings(userKey);
  if (settings.preferences.defaultLanding === "last_app" && lastRoute) {
    return lastRoute;
  }
  return "/app";
}

export const settingsWritePolicy = {
  canWriteSection: (section: SettingsSection) => {
    void section;
    return true;
  },
  getWritePermissionForSection,
};
