export const APP_NAMESPACE = "kutm-shell";

export function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function isDesktopWrapperEnvironment(): boolean {
  return import.meta.env.VITE_DESKTOP_WRAPPER === "1";
}

export function makeStorageKey(key: string): string {
  return `${APP_NAMESPACE}:${key}`;
}
