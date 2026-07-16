import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /(?:image|tabular|structured).*\.spec\.ts/,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5192",
    headless: true
  },
  webServer: {
    command: "npm run dev -- --port 5192 --strictPort",
    url: "http://127.0.0.1:5192/omni-converter/",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
