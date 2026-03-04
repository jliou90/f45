import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "unit",
      environment: "jsdom",
      setupFiles: ["apps/web/src/test/setup.ts"],
      include: [
        "apps/web/src/**/*.test.ts",
        "apps/web/src/**/*.test.tsx",
        "packages/**/src/**/*.test.ts",
        "packages/**/src/**/*.test.tsx"
      ],
      exclude: ["**/node_modules/**", "apps/web/src/test/**"]
    }
  },
  {
    test: {
      name: "integration",
      environment: "jsdom",
      setupFiles: ["apps/web/src/test/setup.ts"],
      include: ["apps/web/src/**/*.integration.test.tsx"],
      exclude: ["**/node_modules/**"]
    }
  }
]);
