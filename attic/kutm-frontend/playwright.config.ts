import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/src/test",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true
  },
  webServer: {
    command: "pnpm --filter @kutm/web preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true
  }
});
