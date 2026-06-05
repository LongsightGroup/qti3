import { cp, readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ResolvedConfig, defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const galleryHtmlPath = resolve(repoRoot, "examples/manual/sv-gallery/index.html");
const svMatrixItemsPath = resolve(repoRoot, "packages/fixtures/packages/sv-matrix/items");
let buildOutDir = "";

export default defineConfig({
  resolve: {
    alias: {
      "@longsightgroup/qti3-player": resolve(repoRoot, "packages/player/src/index.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(repoRoot, "examples/manual/index.html"),
        "sv-gallery/index": galleryHtmlPath,
      },
    },
  },
  plugins: [
    {
      name: "qti3-playwright-health-check",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (!request.headers.accept) {
            request.headers.accept = "*/*";
          }
          next();
        });
      },
    },
    {
      name: "qti3-sv-gallery",
      configResolved(config: ResolvedConfig) {
        buildOutDir = isAbsolute(config.build.outDir)
          ? config.build.outDir
          : resolve(config.root, config.build.outDir);
      },
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const pathname = request.url?.split("?")[0];
          if (pathname !== "/sv-gallery" && pathname !== "/sv-gallery/") {
            next();
            return;
          }

          try {
            const html = await readFile(galleryHtmlPath, "utf8");
            const transformedHtml = await server.transformIndexHtml(
              request.url ?? "/sv-gallery",
              html.replace(`src="../src/sv-gallery.ts"`, `src="/src/sv-gallery.ts"`),
            );
            response.statusCode = 200;
            response.setHeader("Content-Type", "text/html");
            response.end(transformedHtml);
          } catch (error) {
            next(error);
          }
        });
      },
      async writeBundle() {
        await cp(
          svMatrixItemsPath,
          resolve(buildOutDir, "packages/fixtures/packages/sv-matrix/items"),
          { recursive: true },
        );
      },
    },
  ],
});
