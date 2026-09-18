#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseQtiTest } from "../packages/core/dist/index.js";
import {
  writeQti3AssessmentTest,
  writeQti3FixedAssessmentTest,
  qti3TrustedXmlFragment,
} from "../packages/writer/dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const closure = JSON.parse(
  await readFile(join(root, "packages/conformance/schemas/qti3/sources.json"), "utf8"),
);
const directory = await mkdtemp(join(tmpdir(), "qti3-test-xsd-"));
try {
  for (const [url, source] of Object.entries(closure.sources)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Schema download failed: ${url} (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== source.sha256)
      throw new Error(`Official schema changed: ${url}. Review and update the pinned digest.`);
    const encoding =
      bytes[0] === 255 && bytes[1] === 254
        ? "utf-16le"
        : bytes[0] === 254 && bytes[1] === 255
          ? "utf-16be"
          : "utf-8";
    let xml = new TextDecoder(encoding)
      .decode(bytes)
      .replace(/encoding=['"]UTF-16['"]/gi, 'encoding="UTF-8"');
    xml = xml.replace(/schemaLocation=(['"])([^'"]+)\1/g, (_match, quote, location) => {
      const target = closure.sources[new URL(location, url).href];
      if (!target) throw new Error(`Unpinned schema dependency: ${location}.`);
      return `schemaLocation=${quote}${target.file}${quote}`;
    });
    await writeFile(join(directory, source.file), xml);
  }
  const fixture = await readFile(join(root, "tests/fixtures/staged-assessment-test.xml"), "utf8");
  const parsed = parseQtiTest(fixture);
  if (!parsed.ok) throw new Error("Staged test fixture did not parse.");
  const written = writeQti3AssessmentTest(parsed.value);
  if (!written.ok) throw new Error("Staged test fixture did not serialize.");
  const fixed = writeQti3FixedAssessmentTest({
    identifier: "fixed",
    title: "Fixed options",
    parts: [
      {
        identifier: "part",
        title: "Part",
        navigationMode: "nonlinear",
        submissionMode: "simultaneous",
        timeLimits: { minTime: 5, maxTime: 300 },
        instructions: qti3TrustedXmlFragment("<p>Read carefully.</p>"),
        sections: [
          {
            identifier: "section",
            title: "Questions",
            items: [{ identifier: "ref", href: "items/one.xml", categories: [] }],
          },
        ],
        feedback: [
          {
            identifier: "feedback",
            access: "atEnd",
            showHide: "show",
            outcomeIdentifier: "FEEDBACK",
            content: qti3TrustedXmlFragment("<p>Finished.</p>"),
          },
        ],
      },
    ],
  });
  if (!fixed.ok) throw new Error("Fixed test fixture did not serialize.");
  const fixedInstance = join(directory, "fixed.xml");
  await writeFile(fixedInstance, fixed.value);
  execFileSync(
    "xmllint",
    ["--nonet", "--noout", "--schema", join(directory, closure.main), fixedInstance],
    { stdio: "inherit" },
  );
  const instance = join(directory, "test.xml");
  await writeFile(instance, written.value);
  execFileSync(
    "xmllint",
    ["--nonet", "--noout", "--schema", join(directory, closure.main), instance],
    { stdio: "inherit" },
  );
  console.log(
    "QTI 3 staged assessment: official ASI schema validation passed (pinned source hashes).",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
