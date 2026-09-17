import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 3000,
    hmr: false,
    // Dev: same-origin proxy to the local Convex backend, so the browser
    // never needs to know the backend URL (which convex dev keeps rewriting).
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3210",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
