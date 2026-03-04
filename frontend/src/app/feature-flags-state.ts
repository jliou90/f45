import { createContext } from "react";
import type { FeatureFlags } from "../lib/feature-flags";

export type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  reload: () => Promise<void>;
};

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

