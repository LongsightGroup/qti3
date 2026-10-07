import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { assertQtiXmlSchema } from "./valid-qti-document.js";

const previousOut = process.env.QTI3_TEST_XSD_OUT;
const previousSchema = process.env.QTI3_TEST_XSD_SCHEMA;

afterEach(() => {
  restoreEnv("QTI3_TEST_XSD_OUT", previousOut);
  restoreEnv("QTI3_TEST_XSD_SCHEMA", previousSchema);
});

it("records each distinct schema-gate document once", () => {
  const directory = mkdtempSync(join(tmpdir(), "qti3-xsd-out-"));
  process.env.QTI3_TEST_XSD_OUT = directory;
  process.env.QTI3_TEST_XSD_SCHEMA = join(directory, "missing.xsd");
  try {
    const first = "<qti-assessment-item/>";
    const second = '<qti-assessment-item id="other"/>';
    assertQtiXmlSchema(first);
    assertQtiXmlSchema(first);
    assertQtiXmlSchema(second);
    const files = readdirSync(directory).filter((name) => name.endsWith(".xml"));
    expect(files).toHaveLength(2);
    expect(files.map((name) => readFileSync(join(directory, name), "utf8")).toSorted()).toEqual(
      [first, second].toSorted(),
    );
    for (const file of files) {
      expect(readFileSync(join(directory, file.replace(/\.xml$/, ".name")), "utf8")).toBe(
        "records each distinct schema-gate document once\n",
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function restoreEnv(name: "QTI3_TEST_XSD_OUT" | "QTI3_TEST_XSD_SCHEMA", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
