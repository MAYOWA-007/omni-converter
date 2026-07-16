import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /media(?:RoundTrip|InputFormats|Core|Contract|EncoderProbe|PreciseTrim)\.spec\.ts/,
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: "http://127.0.0.1:5193",
    headless: true
  },
  webServer: {
    command: "npm run dev -- --port 5193 --strictPort",
    url: "http://127.0.0.1:5193/omni-converter/",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
