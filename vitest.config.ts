import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@longsightgroup/qti3-core",
        replacement: fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      },
      {
        find: "@longsightgroup/qti3-fixtures",
        replacement: fileURLToPath(new URL("./packages/fixtures/src/index.ts", import.meta.url)),
      },
      {
        find: "@longsightgroup/qti3-player",
        replacement: fileURLToPath(new URL("./packages/player/src/index.ts", import.meta.url)),
      },
      {
        find: "@longsightgroup/qti3-conformance",
        replacement: fileURLToPath(new URL("./packages/conformance/src/index.ts", import.meta.url)),
      },
      {
        find: "@longsightgroup/qti3-a11y",
        replacement: fileURLToPath(new URL("./packages/a11y/src/index.ts", import.meta.url)),
      },
      {
        find: "@longsightgroup/qti3-pnp",
        replacement: fileURLToPath(new URL("./packages/pnp/src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    globals: false,
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "tests/browser/shared-vocabulary-matrix/coverage-policy.test.ts",
    ],
    allowOnly: !process.env.CI,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
