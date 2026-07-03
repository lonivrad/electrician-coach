import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Content packs live outside src/ and are imported as raw YAML (?raw) then
// parsed at runtime. fs.allow lets Vite serve them in dev.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./engine", import.meta.url)),
      "@packs": fileURLToPath(new URL("./content-packs", import.meta.url)),
    },
  },
  server: {
    fs: { allow: [".."] },
  },
});
