import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Mirror the app's path aliases so tests can import modules that use @engine.
export default defineConfig({
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./engine", import.meta.url)),
      "@packs": fileURLToPath(new URL("./content-packs", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node", // per-file override to jsdom via `// @vitest-environment jsdom`
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["engine/**", "src/data/**", "src/state/**"],
      // Floors set just below current coverage (rounded down to the nearest 5)
      // so the gate passes today and guards against regressions.
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 95,
        lines: 90,
      },
    },
  },
});
