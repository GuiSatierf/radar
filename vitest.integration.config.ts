import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests hit the local *_test database (TEST_DATABASE_URL), never dev or production.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: [
      "src/**/*.integration.test.ts",
      "scripts/**/*.integration.test.ts",
    ],
    fileParallelism: false,
    setupFiles: ["./tests/integration-setup.ts"],
  },
});
