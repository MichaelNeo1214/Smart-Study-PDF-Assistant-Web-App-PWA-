import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
  build: {
    // PDF.js ships a large local worker and the app is intentionally a PWA.
    chunkSizeWarningLimit: 1_800,
  },
});
