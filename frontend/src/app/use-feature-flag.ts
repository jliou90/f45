import { useFeatureFlags } from "./use-feature-flags";

export function useFeatureFlag(key: string, fallback = false): boolean | string | number {
  const { flags } = useFeatureFlags();
  const value = flags[key];
  return value === undefined ? fallback : value;
}
