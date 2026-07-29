import { describe, expect, it } from "vitest";

import { qtiTranscodeProfiles, transcodeQti3Item, transcodeQti3Package } from "./index.js";
import { fixtureXml, vendorFixturePackage } from "./transcoder.test-helpers.js";

describe("vendor QTI 2.1 profiles", () => {
  it.each(["blackboard-question-banks@1", "brightspace-course-import@1"] as const)(
    "requires an explicit conservative policy for every non-native interaction in %s",
    (profileId) => {
      const policies = qtiTranscodeProfiles[profileId].interactions;
      const nativeInteractions = Object.entries(policies)
        .filter(([, policy]) => policy.transformation === "native")
        .map(([interaction]) => interaction)
        .toSorted();

      expect(nativeInteractions).toEqual(["choice", "extendedText", "textEntry"]);
    },
  );

  it("omits Blackboard response processing instead of emitting an item Blackboard skips", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("choice") },
      { profile: "blackboard-question-banks@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<choiceInteraction");
    expect(result.xml).not.toContain("<responseProcessing");
    expect(result.report.mappings[0]).toMatchObject({
      sourceInteraction: "choice",
      emittedInteraction: "choiceInteraction",
      fidelity: "exact",
      scoring: "unscored",
    });
    expect(result.report.fidelity).toBe("lossy");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "profile.blackboard.response_processing.omitted",
          severity: "warning",
          path: "/responseProcessing",
        }),
      ]),
    );
  });

  it.each(["blackboard-question-banks@1", "brightspace-course-import@1"] as const)(
    "turns undocumented ordering into a manual written response for %s",
    (profile) => {
      const result = transcodeQti3Item({ kind: "xml", xml: fixtureXml("order") }, { profile });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.xml).toContain(
        '<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">',
      );
      expect(result.xml).toContain("<extendedTextInteraction");
      expect(result.xml).toContain("Source options:");
      expect(result.xml).toContain(
        "Set up identical trays with the same soil, seed type, and water schedule.",
      );
      expect(result.xml).not.toContain("<orderInteraction");
      expect(result.xml).not.toContain("<correctResponse");
      expect(result.xml).not.toContain("<responseProcessing");
      expect(result.report.mappings[0]).toMatchObject({
        sourceInteraction: "order",
        emittedInteraction: "extendedTextInteraction",
        fidelity: "lossy",
        scoring: "manual",
        fallback: "extended-text",
      });
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: `profile.${profile.startsWith("blackboard") ? "blackboard" : "brightspace"}.order.manual_fallback`,
            severity: "warning",
            path: "/itemBody/interactions/0",
          }),
          expect.objectContaining({
            code: "profile.qti21.manual_fallback.response_processing_omitted",
            severity: "warning",
            path: "/responseProcessing",
          }),
        ]),
      );
    },
  );

  it.each(["blackboard-question-banks@1", "brightspace-course-import@1"] as const)(
    "preserves every interaction when unwrapping a position-object stage for %s",
    (profile) => {
      const result = transcodeQti3Item(
        {
          kind: "xml",
          xml: `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="two-markers" title="Two markers" time-dependent="false">
  <qti-response-declaration identifier="FIRST" cardinality="single" base-type="point"/>
  <qti-response-declaration identifier="SECOND" cardinality="single" base-type="point"/>
  <qti-item-body>
    <qti-position-object-stage>
      <object data="stage.svg" type="image/svg+xml"/>
      <qti-position-object-interaction response-identifier="FIRST">
        <qti-prompt>Place the first marker.</qti-prompt>
        <object data="first.svg" type="image/svg+xml"/>
      </qti-position-object-interaction>
      <qti-position-object-interaction response-identifier="SECOND">
        <qti-prompt>Place the second marker.</qti-prompt>
        <object data="second.svg" type="image/svg+xml"/>
      </qti-position-object-interaction>
    </qti-position-object-stage>
  </qti-item-body>
</qti-assessment-item>`,
        },
        { profile },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.report.mappings).toHaveLength(2);
      expect([...result.xml.matchAll(/<extendedTextInteraction/g)]).toHaveLength(2);
      expect(result.xml).toContain("Place the first marker.");
      expect(result.xml).toContain("Place the second marker.");
      expect(result.xml).toContain("first.svg");
      expect(result.xml).toContain("second.svg");
    },
  );

  it.each(["blackboard-question-banks@1", "brightspace-course-import@1"] as const)(
    "emits a conservative QTI 2.1 package for %s",
    async (profile) => {
      const result = await transcodeQti3Package(
        { kind: "authoringPackage", package: vendorFixturePackage },
        { profile },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const manifest = result.files.find((file) => file.path === "imsmanifest.xml")?.data;
      const choice = result.files.find((file) => file.path === "items/choice.xml")?.data;
      const order = result.files.find((file) => file.path === "items/order.xml")?.data;
      expect(manifest).toEqual(expect.any(String));
      expect(manifest).toContain("<schemaversion>2.1</schemaversion>");
      expect(manifest).toContain('type="imsqti_item_xmlv2p1"');
      expect(choice).toEqual(expect.any(String));
      expect(choice).toContain("<choiceInteraction");
      expect(order).toEqual(expect.any(String));
      expect(order).toContain("<extendedTextInteraction");
      expect(order).toContain("Source options:");
      expect(order).not.toContain("<orderInteraction");
      expect(result.reports).toHaveLength(2);
      expect(result.reports[1]?.mappings[0]).toMatchObject({
        sourceInteraction: "order",
        emittedInteraction: "extendedTextInteraction",
        fidelity: "lossy",
        scoring: "manual",
        fallback: "extended-text",
      });
    },
  );
});
