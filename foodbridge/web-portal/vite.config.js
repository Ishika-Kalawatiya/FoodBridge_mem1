import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envDir: "..",
  server: {
    port: 5174,
    proxy: { "/api": "http://localhost:4000" }, // so the portal can call /api without CORS
  },
});
