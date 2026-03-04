import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@kutm/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@kutm/ui-platform": resolve(__dirname, "packages/ui-platform/src/index.ts"),
      "@kutm/contracts": resolve(__dirname, "packages/contracts/src/index.ts"),
      "@kutm/mocks": resolve(__dirname, "packages/mocks/src/index.ts")
    }
  },
  test: {
    projects: [
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
          exclude: ["**/node_modules/**", "apps/web/src/test/**", "**/*.integration.test.tsx"]
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
    ]
  }
});
