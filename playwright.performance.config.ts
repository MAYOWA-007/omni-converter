import { defineConfig } from "playwright/test";

const port = Number(process.env.OMNI_PERFORMANCE_PORT ?? 5190);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /performance\.spec\.ts/,
  workers: 1,
  timeout: 30_000,
  projects: [{ name: "performance" }],
  use: {
    baseURL,
    headless: true
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `${baseURL}/omni-converter/`,
    reuseExistingServer: false,
    timeout: 180_000
  }
});
