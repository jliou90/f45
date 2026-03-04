import type { UserSettingsV1 } from "./settings.storage";

export type SessionDeviceItem = {
  id: string;
  label: string;
  lastSeenAt: string;
  current: boolean;
};

export async function loadSessionDevices(): Promise<{ supported: false; items: SessionDeviceItem[] }> {
  return { supported: false, items: [] };
}

export async function signOutOtherSessions(): Promise<{ supported: false }> {
  return { supported: false };
}

export async function saveSettingsRemote(settings: UserSettingsV1): Promise<{ supported: false }> {
  void settings;
  return { supported: false };
}
