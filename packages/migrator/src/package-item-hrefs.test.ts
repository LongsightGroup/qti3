import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { selectPackageItemHrefs } from "./package-item-hrefs.js";
import { buildMigrationEntry, parseMigratableManifest, readMigrationSource } from "./source.js";

function createStoredZip(files: Record<string, string | Uint8Array>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, data]) => [
        path,
        typeof data === "string" ? strToU8(data) : data,
      ]),
    ),
    { level: 0 },
  );
}

describe("selectPackageItemHrefs", () => {
  it("resolves QTI 1.2 assessment itemrefs through manifest resource identifiers", () => {
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="MANIFEST">
  <resources>
    <resource identifier="ASSESSMENT_TEST" type="imsqti_xmlv1p2" href="tests/assessment.xml">
      <file href="tests/assessment.xml"/>
      <dependency identifierref="RESOURCE_1"/>
      <dependency identifierref="RESOURCE_2"/>
      <dependency identifierref="RESOURCE_3"/>
    </resource>
    <resource identifier="RESOURCE_1" type="imsqti_item_xmlv1p2" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
    <resource identifier="RESOURCE_2" type="imsqti_item_xmlv1p2" href="items/order.xml">
      <file href="items/order.xml"/>
    </resource>
    <resource identifier="RESOURCE_3" type="imsqti_item_xmlv1p2" href="items/slider.xml">
      <file href="items/slider.xml"/>
    </resource>
    <resource identifier="UNUSED" type="imsqti_item_xmlv1p2" href="items/unused.xml">
      <file href="items/unused.xml"/>
    </resource>
  </resources>
</manifest>`;
    const assessment = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="assessment" title="Assessment">
    <section ident="section" title="Section">
      <itemref linkrefid="RESOURCE_1"></itemref>
      <itemref linkrefid="RESOURCE_2"></itemref>
      <itemref linkrefid="RESOURCE_3"></itemref>
    </section>
  </assessment>
</questestinterop>`;
    const bytes = createStoredZip({
      "imsmanifest.xml": manifest,
      "tests/assessment.xml": assessment,
      "items/choice.xml": qti12Item("choice"),
      "items/order.xml": qti12Item("order"),
      "items/slider.xml": qti12Item("slider"),
      "items/unused.xml": qti12Item("unused"),
    });
    const source = readMigrationSource({ filename: "package.zip", bytes });
    const parsedManifest = parseMigratableManifest(
      source.entries.find((entry) => entry.path === "imsmanifest.xml")?.text ?? "",
    );
    const entriesByPath = new Map(source.entries.map((entry) => [entry.path, entry]));

    expect(selectPackageItemHrefs("qti12", parsedManifest, entriesByPath)).toEqual([
      "items/choice.xml",
      "items/order.xml",
      "items/slider.xml",
    ]);
  });

  it("keeps embedded QTI 1.2 item resources when no assessment itemrefs are present", () => {
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST">
  <resources>
    <resource identifier="ITEM_1" type="imsqti_xmlv1p2" href="assessment/quiz.xml">
      <file href="assessment/quiz.xml"/>
    </resource>
  </resources>
</manifest>`;
    const quiz = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <item ident="choice12" title="Choice 12"><presentation><material><mattext>Pick.</mattext></material></presentation></item>
</questestinterop>`;
    const entries = [
      buildMigrationEntry("imsmanifest.xml", strToU8(manifest)),
      buildMigrationEntry("assessment/quiz.xml", strToU8(quiz)),
    ];
    const parsedManifest = parseMigratableManifest(manifest);
    const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));

    expect(selectPackageItemHrefs("qti12", parsedManifest, entriesByPath)).toEqual([
      "assessment/quiz.xml",
    ]);
  });

  it("ignores assessment resources that do not contain itemrefs", () => {
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST">
  <resources>
    <resource identifier="ITEM_1" type="imsqti_item_xmlv1p2" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`;
    const entries = [
      buildMigrationEntry("imsmanifest.xml", strToU8(manifest)),
      buildMigrationEntry("items/choice.xml", strToU8(qti12Item("choice"))),
    ];
    const parsedManifest = parseMigratableManifest(manifest);
    const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));

    expect(selectPackageItemHrefs("qti21", parsedManifest, entriesByPath)).toEqual([
      "items/choice.xml",
    ]);
  });

  it("does not migrate XML files that are not declared item resources", () => {
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST">
  <resources>
    <resource identifier="ASSESSMENT" type="imsqti_xmlv1p2" href="assessment.xml">
      <file href="assessment.xml"/>
    </resource>
  </resources>
</manifest>`;
    const assessment = `<questestinterop><item ident="choice" title="Choice"/></questestinterop>`;
    const entries = [
      buildMigrationEntry("assessment.xml", strToU8(assessment)),
      buildMigrationEntry(
        "metadata.xml",
        strToU8("<metadata><item>Not a QTI item.</item></metadata>"),
      ),
    ];
    const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));

    expect(
      selectPackageItemHrefs("qti12", parseMigratableManifest(manifest), entriesByPath),
    ).toEqual(["assessment.xml"]);
  });
});

function qti12Item(identifier: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<item ident="${identifier}" title="${identifier}"><presentation><material><mattext>Prompt.</mattext></material></presentation></item>`;
}
