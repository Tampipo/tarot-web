import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Run from the repo root via: vite --config packages/web/vite.config.ts
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      // Bundle the scoring engine straight from source — the web build never
      // needs the shared package to be compiled first.
      "@tarot/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Convenience for non-docker `npm run dev`: proxy /api to the local API.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
