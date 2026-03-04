import { describe, expect, it } from "vitest";
import { addRecentRoute, getRecentRoutes } from "../lib/prefs";

describe("recent route prefs", () => {
  it("tracks recent routes with newest first and max 10", () => {
    localStorage.clear();
    const user = "user@example.com";

    for (let index = 0; index < 12; index += 1) {
      addRecentRoute(`/route-${index}`, user);
    }

    addRecentRoute("/route-5", user);

    const routes = getRecentRoutes(user);
    expect(routes[0]).toBe("/route-5");
    expect(routes.length).toBe(10);
    expect(routes.includes("/route-0")).toBe(false);
  });
});