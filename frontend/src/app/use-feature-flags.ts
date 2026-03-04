import { useContext } from "react";
import { FeatureFlagsContext } from "./feature-flags-state";

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used inside FeatureFlagsProvider");
  }
  return context;
}

