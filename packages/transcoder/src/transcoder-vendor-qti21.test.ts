import { describe, expect, it } from "vitest";
import {
  parseQtiPackageXmlTree,
  parseQtiXml,
  type QtiPackageXmlNode,
} from "@longsightgroup/qti3-core";

import { qtiTranscodeProfiles, transcodeQti3Item, transcodeQti3Package } from "./index.js";
import { fixtureXml, vendorFixturePackage } from "./transcoder.test-helpers.js";

describe("vendor QTI 2.1 profiles", () => {
  it.each(["blackboard-question-banks@1", "brightspace-course-import@1"] as const)(
    "keeps empty anchors before lifted fallbacks for %s",
    (profile) => {
      const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="anchored-control" title="Anchored control" time-dependent="false">
          <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="boolean"/>
          <qti-item-body><div><p><span id="anchor"><qti-end-attempt-interaction response-identifier="RESPONSE" title="Finish"/></span></p></div></qti-item-body>
        </qti-assessment-item>`;
      expect(parseQtiXml(xml).ok).toBe(true);
      const result = transcodeQti3Item({ kind: "xml", xml }, { profile });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.xml).toContain('<p><span id="anchor"></span></p><extendedTextInteraction');
      expect(result.xml.match(/id="anchor"/g)).toHaveLength(1);
    },
  );

  it.each(["blackboard-question-banks@1", "brightspace-course-import@1"] as const)(
    "lifts nested essay fallbacks while preserving surrounding text and unique anchors for %s",
    (profile) => {
      const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="nested-controls" title="Nested controls" time-dependent="false">
        <qti-response-declaration identifier="FIRST" cardinality="single" base-type="boolean"/>
        <qti-response-declaration identifier="SECOND" cardinality="single" base-type="boolean"/>
        <qti-item-body><div><p id="outer">Before <span id="inner" class="context">inside <strong id="emphasis">start <qti-end-attempt-interaction response-identifier="FIRST" title="First"/> between <qti-end-attempt-interaction response-identifier="SECOND" title="Second"/> finish</strong> outside</span> after</p></div></qti-item-body>
      </qti-assessment-item>`;
      expect(parseQtiXml(xml).ok).toBe(true);
      const result = transcodeQti3Item({ kind: "xml", xml }, { profile });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const root = parseQtiPackageXmlTree(result.xml).root;
      if (!root) throw new Error("Expected exported item");
      const nodes: QtiPackageXmlNode[] = [];
      const parents: string[] = [];
      const visit = (node: QtiPackageXmlNode, parent?: QtiPackageXmlNode) => {
        nodes.push(node);
        if (node.localName === "extendedTextInteraction") parents.push(parent?.localName ?? "");
        for (const child of node.children) visit(child, node);
      };
      visit(root);
      expect(parents).toEqual(["div", "div"]);
      for (const id of ["outer", "inner", "emphasis"]) {
        expect(nodes.filter((node) => node.attributes.id === id)).toHaveLength(1);
      }
      expect(result.xml).toMatch(
        /Before[\s\S]*inside[\s\S]*start[\s\S]*responseIdentifier="FIRST"[\s\S]*between[\s\S]*responseIdentifier="SECOND"[\s\S]*finish[\s\S]*outside[\s\S]*after/,
      );
      expect(result.xml).toContain('<span class="context">');
      expect(result.xml).toContain("<strong> between </strong>");
      expect(result.report.mappings.map((mapping) => mapping.scoring)).toEqual([
        "manual",
        "manual",
      ]);
    },
  );

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
    <div>Place the first marker.</div><div>Place the second marker.</div><qti-position-object-stage>
      <object data="stage.svg" type="image/svg+xml"/>
      <qti-position-object-interaction response-identifier="FIRST">

        <object data="first.svg" type="image/svg+xml"/>
      </qti-position-object-interaction>
      <qti-position-object-interaction response-identifier="SECOND">

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
