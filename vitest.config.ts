import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@longsightgroup/qti3-core": new URL("./packages/core/src/index.ts", import.meta.url)
        .pathname,
      "@longsightgroup/qti3-fixtures": new URL("./packages/fixtures/src/index.ts", import.meta.url)
        .pathname,
      "@longsightgroup/qti3-player": new URL("./packages/player/src/index.ts", import.meta.url)
        .pathname,
      "@longsightgroup/qti3-conformance": new URL(
        "./packages/conformance/src/index.ts",
        import.meta.url,
      ).pathname,
      "@longsightgroup/qti3-a11y": new URL("./packages/a11y/src/index.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["packages/**/*.test.ts", "packages/**/*.test.tsx"],
  },
});
