import { describe, expect, it } from "vitest";
import { getLauncherTiles, getNavModel } from "../plugins/registry";

describe("Plugin registry gating", () => {
  it("hides scaffold modules when scaffold feature flag is disabled", () => {
    const nav = getNavModel({ featureFlags: { scaffoldEnabled: false }, isDev: true });
    expect(nav.some((item) => item.to === "/reports")).toBe(false);
  });

  it("shows scaffold modules when scaffold feature flag is enabled", () => {
    const nav = getNavModel({ featureFlags: { scaffoldEnabled: true }, isDev: true });
    expect(nav.some((item) => item.to === "/reports")).toBe(true);
  });

  it("shows comms module when feature flag is enabled", () => {
    const flags = { commsEnabled: true, accountingBeta: true, scaffoldEnabled: true };
    const nav = getNavModel({ featureFlags: flags, isDev: true });
    const launcher = getLauncherTiles({ featureFlags: flags, isDev: true });

    expect(nav.some((item) => item.to === "/comms")).toBe(true);
    expect(launcher.some((item) => item.id === "tile-comms")).toBe(true);
  });

  it("hides comms module when feature flag is disabled", () => {
    const flags = { commsEnabled: false, accountingBeta: true, scaffoldEnabled: true };
    const nav = getNavModel({ featureFlags: flags, isDev: true });
    const launcher = getLauncherTiles({ featureFlags: flags, isDev: true });

    expect(nav.some((item) => item.to === "/comms")).toBe(false);
    expect(launcher.some((item) => item.id === "tile-comms")).toBe(false);
  });
});
