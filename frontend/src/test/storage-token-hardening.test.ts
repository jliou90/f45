import { beforeEach, describe, expect, it } from "vitest";
import {
  STORAGE_KEYS,
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens,
} from "../lib/storage";

describe("token storage hardening", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearStoredTokens();
  });

  it("stores auth tokens in sessionStorage, not localStorage", () => {
    setStoredTokens({ accessToken: "a1", refreshToken: "r1" });

    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBe("a1");
    expect(sessionStorage.getItem(STORAGE_KEYS.refreshToken)).toBe("r1");
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.refreshToken)).toBeNull();
  });

  it("migrates legacy localStorage tokens into sessionStorage on read", () => {
    localStorage.setItem(STORAGE_KEYS.accessToken, "legacy-a");
    localStorage.setItem(STORAGE_KEYS.refreshToken, "legacy-r");

    expect(getStoredAccessToken()).toBe("legacy-a");
    expect(getStoredRefreshToken()).toBe("legacy-r");
    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBe("legacy-a");
    expect(sessionStorage.getItem(STORAGE_KEYS.refreshToken)).toBe("legacy-r");
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.refreshToken)).toBeNull();
  });
});
