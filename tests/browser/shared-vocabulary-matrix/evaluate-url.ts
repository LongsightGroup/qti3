import { join } from "node:path";

/** Vite `/@fs` URL for importing assertion-core inside Playwright page.evaluate. */
export const SV_ASSERTION_CORE_URL = `/@fs${join(
  process.cwd(),
  "tests/browser/shared-vocabulary-matrix/assertion-core.ts",
)}`;
