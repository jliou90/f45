import type { UserSettingsV1 } from "./settings.storage";
import { kutmApi } from "../../../lib/kutm";

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

export type MfaEnrollStart = {
  secret: string;
  otpauth_url: string;
  mfa_enabled: boolean;
};

export type MfaStatus = {
  ok: boolean;
  mfa_enabled: boolean;
};

export async function startMfaEnrollment(): Promise<MfaEnrollStart> {
  return kutmApi.post<MfaEnrollStart>("/auth/mfa/enroll/start", {}, true);
}

export async function verifyMfaEnrollment(otpCode: string): Promise<MfaStatus> {
  return kutmApi.post<MfaStatus>("/auth/mfa/enroll/verify", { otp_code: otpCode }, true);
}

export async function disableMfa(otpCode: string): Promise<MfaStatus> {
  return kutmApi.post<MfaStatus>("/auth/mfa/disable", { otp_code: otpCode }, true);
}
