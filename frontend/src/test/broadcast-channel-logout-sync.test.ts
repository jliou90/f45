import { describe, expect, it, vi } from "vitest";

describe("BroadcastChannel cross-tab logout sync", () => {
  it("delivers LOGOUT from another tab", async () => {
    const channels: FakeBroadcastChannel[] = [];

    class FakeBroadcastChannel {
      name: string;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(name: string) {
        this.name = name;
        channels.push(this);
      }

      postMessage(payload: unknown) {
        // local publish path handled by window-sync notify.
        void payload;
      }

      close() {
        this.onmessage = null;
      }

      emitExternal(payload: unknown) {
        this.onmessage?.({ data: payload } as MessageEvent);
      }
    }

    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel as unknown as typeof BroadcastChannel);
    vi.resetModules();

    const { subscribeWindowSync } = await import("../lib/window-sync");
    const logoutSpy = vi.fn();
    const unsubscribe = subscribeWindowSync((event) => {
      if (event.type === "LOGOUT") {
        logoutSpy();
      }
    });

    const channel = channels[0];
    channel.emitExternal({ type: "LOGOUT", sourceId: "other-tab", at: new Date().toISOString() });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
