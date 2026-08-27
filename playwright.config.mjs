import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./design/visual-tests",
  outputDir: "./test-results",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4179",
    browserName: "chromium",
  },
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://127.0.0.1:4179/design/examples/index.html",
    reuseExistingServer: false,
  },
});

