import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/omni-converter/",
  plugins: [react()],
  server: {
    port: 5187
  },
  preview: {
    port: 4187
  }
});
