import { defineConfig } from "playwright/test";

const port = Number(process.env.OMNI_TEST_PORT ?? 5188);
const baseURL = `http://127.0.0.1:${port}`;

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
    baseURL,
    headless: true
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `${baseURL}/omni-converter/`,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
