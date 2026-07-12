import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Media suites can each hold multiple encoder WASM modules. Serializing them
  // on shared CI runners prevents Chromium from being killed under peak load.
  workers: process.env.CI ? 1 : 3,
  timeout: 30_000,
  projects: [
    {
      name: "functional",
      testIgnore: /performance\.spec\.ts/
    }
  ],
  use: {
    baseURL: "http://127.0.0.1:5188",
    headless: true
  },
  webServer: {
    command: "npm run dev -- --port 5188 --strictPort",
    url: "http://127.0.0.1:5188/omni-converter/",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
