import { access, cp, readdir, readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { type ResolvedConfig, defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const galleryHtmlPath = resolve(repoRoot, "examples/manual/sv-gallery/index.html");
const svMatrixItemsPath = resolve(repoRoot, "packages/fixtures/packages/sv-matrix/items");
const oneEdTechExamplesRoot = resolve(
  repoRoot,
  process.env.QTI3_1EDTECH_EXAMPLES_ROOT ?? "../qti-examples/qtiv3-examples",
);
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
        "1edtech": resolve(repoRoot, "examples/manual/1edtech.html"),
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
    {
      name: "qti3-1edtech-examples",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (url.pathname === "/__1edtech/index.json") {
            const payload = await oneEdTechIndexPayload(oneEdTechExamplesRoot);
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(payload));
            return;
          }

          if (!url.pathname.startsWith("/__1edtech/file/")) {
            next();
            return;
          }

          const requestedPath = decodeURIComponent(url.pathname.slice("/__1edtech/file/".length));
          const filePath = resolve(oneEdTechExamplesRoot, requestedPath);
          if (!isPathInside(oneEdTechExamplesRoot, filePath)) {
            response.statusCode = 403;
            response.end("Forbidden");
            return;
          }

          try {
            const content = await readFile(filePath);
            response.statusCode = 200;
            response.setHeader("Content-Type", contentTypeForPath(filePath));
            response.end(content);
          } catch (error) {
            next(error);
          }
        });
      },
    },
  ],
});

interface OneEdTechExampleIndexEntry {
  path: string;
  name: string;
  group: string;
  kind: "item" | "test" | "xml";
  identifier?: string | undefined;
  title?: string | undefined;
}

interface OneEdTechIndexPayload {
  root: string;
  examples: OneEdTechExampleIndexEntry[];
  error?: string | undefined;
}

async function oneEdTechIndexPayload(root: string): Promise<OneEdTechIndexPayload> {
  try {
    await access(root);
    return { root, examples: await indexOneEdTechExamples(root) };
  } catch {
    return {
      root,
      examples: [],
      error:
        "Clone https://github.com/1EdTech/qti-examples next to this repo, or set QTI3_1EDTECH_EXAMPLES_ROOT to qti-examples/qtiv3-examples.",
    };
  }
}

async function indexOneEdTechExamples(root: string): Promise<OneEdTechExampleIndexEntry[]> {
  const files = await walkXmlFiles(root);
  const entries = await Promise.all(
    files.map(async (filePath) => {
      const path = normalizePath(relative(root, filePath));
      const xml = await readFile(filePath, "utf8");
      const rootElement = xml.match(/<qti-(assessment-item|assessment-test)\b[^>]*>/i)?.[0] ?? "";
      return {
        path,
        name: path.split("/").at(-1) ?? path,
        group: path.split("/").slice(0, 2).join("/"),
        kind: rootElement.includes("assessment-item")
          ? "item"
          : rootElement.includes("assessment-test")
            ? "test"
            : "xml",
        identifier: attributeValue(rootElement, "identifier"),
        title: attributeValue(rootElement, "title"),
      };
    }),
  );
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

async function walkXmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkXmlFiles(entryPath)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".xml") {
      files.push(entryPath);
    }
  }
  return files;
}

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function attributeValue(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

function contentTypeForPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}
