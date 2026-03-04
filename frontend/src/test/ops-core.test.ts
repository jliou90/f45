import { describe, expect, it } from "vitest";
import { addOpsNetwork, exportOpsBundle, getOpsSnapshot, setOpsCaptureEnabled } from "../core/ops";

describe("ops core", () => {
  it("redacts token-like values on export", () => {
    setOpsCaptureEnabled(true);
    addOpsNetwork({
      method: "GET",
      url: "https://example.com/api?access_token=abc123",
      path: "/api",
      status: 500,
      durationMs: 10,
      requestId: "rid-1",
      clientRequestId: "cid-1",
      payloadBytes: null,
      ok: false,
    });

    const payload = exportOpsBundle({ appVersion: "1.0.0", tenantId: "tenant-1", backendStatus: {} });
    expect(payload).not.toContain("abc123");
    expect(payload).toContain("[REDACTED]");
  });

  it("keeps network ring buffer bounded", () => {
    setOpsCaptureEnabled(true);
    for (let i = 0; i < 700; i += 1) {
      addOpsNetwork({
        method: "GET",
        url: `https://example.com/${i}`,
        path: `/p/${i}`,
        status: 200,
        durationMs: i,
        requestId: null,
        clientRequestId: null,
        payloadBytes: null,
        ok: true,
      });
    }

    const snapshot = getOpsSnapshot();
    expect(snapshot.network.length).toBeLessThanOrEqual(500);
  });
});
