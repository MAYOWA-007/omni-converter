import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /performance\.spec\.ts/,
  workers: 1,
  timeout: 30_000,
  projects: [{ name: "performance" }],
  use: {
    baseURL: "http://127.0.0.1:5190",
    headless: true
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 5190 --strictPort",
    url: "http://127.0.0.1:5190/omni-converter/",
    reuseExistingServer: false,
    timeout: 180_000
  }
});
