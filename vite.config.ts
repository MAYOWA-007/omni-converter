import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/omni-converter/",
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "zip-engine", test: /node_modules[\\/]@zip\.js[\\/]zip\.js[\\/]/, priority: 30 },
            { name: "media-engine", test: /node_modules[\\/]mediabunny[\\/]/, priority: 30 }
          ]
        }
      }
    }
  },
  server: {
    port: 5187
  },
  preview: {
    port: 4187
  }
});
