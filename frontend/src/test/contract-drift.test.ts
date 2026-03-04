import { describe, expect, it } from "vitest";
import { checkContractDrift } from "../lib/contracts";

describe("Contract drift detection", () => {
  it("reports generated/runtime drift", () => {
    const doc = {
      paths: {
        "/api/v1/auth/login": { post: {} },
        "/api/v1/custom/new-endpoint": { get: {} },
      },
    };

    const drift = checkContractDrift(doc);

    expect(drift.missingInRuntime.length).toBeGreaterThan(0);
    expect(drift.missingInGenerated.some((item) => item.path === "/api/v1/custom/new-endpoint" && item.method === "GET")).toBe(true);
  });
});
