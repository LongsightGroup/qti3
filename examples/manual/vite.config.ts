import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const galleryHtmlPath = resolve(repoRoot, "tests/browser/fixtures/sv-gallery.html");
const galleryBase = `/@fs${dirname(galleryHtmlPath)}/`;

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
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const pathname = request.url?.split("?")[0];
          if (pathname !== "/sv-gallery" && pathname !== "/sv-gallery/") {
            next();
            return;
          }

          try {
            const html = await readFile(galleryHtmlPath, "utf8");
            const htmlForAlias = html.replace(
              `src="./sv-gallery.ts"`,
              `src="${galleryBase}sv-gallery.ts"`,
            );
            const transformedHtml = await server.transformIndexHtml(
              request.url ?? "/sv-gallery",
              htmlForAlias,
            );
            response.statusCode = 200;
            response.setHeader("Content-Type", "text/html");
            response.end(transformedHtml);
          } catch (error) {
            next(error);
          }
        });
      },
    },
  ],
});
