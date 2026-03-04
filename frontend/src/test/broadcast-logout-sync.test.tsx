import { describe, expect, it, vi } from "vitest";
import { publishWindowSync, subscribeWindowSync } from "../lib/window-sync";

describe("BroadcastChannel logout sync", () => {
  it("delivers LOGOUT events to window sync subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeWindowSync(listener);

    publishWindowSync({ type: "LOGOUT" });

    expect(listener).toHaveBeenCalledWith({ type: "LOGOUT" });
    unsubscribe();
  });
});
