import { createContext, useContext } from "react";
import type { UserSettingsV1 } from "../data/settings.storage";
import type { SettingsPermissionError } from "../data/settings.storage";
import type { SettingsAccessModel } from "../rbac";

export type SettingsContextValue = {
  settings: UserSettingsV1;
  access: SettingsAccessModel;
  saveError: SettingsPermissionError | null;
  clearSaveError: () => void;
  savePartial: (partial: Partial<UserSettingsV1>) => UserSettingsV1;
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettingsState(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettingsState must be used inside SettingsLayout");
  }
  return context;
}
