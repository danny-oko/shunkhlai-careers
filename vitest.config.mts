import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Unit tests only. Each file opts into jsdom with a docblock when it
    // needs a browser global; everything else runs in node.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
