import { describe, expect, it } from "vitest";
import { buildQtiDeliverySafeXml } from "./delivery-security.js";
import { parseXmlTree } from "./xml.js";

describe("parseXmlTree source ranges", () => {
  it("records full element ranges and ignores decoy closing tags in comments and CDATA", () => {
    const xml = `
      <root>
        <!-- </root> decoy -->
        <child><![CDATA[</child> decoy]]></child>
      </root>
    `.trim();

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);
    expect(parsed.root?.sourceRange.endOffset).toBeDefined();

    const child = parsed.root?.children.find((node) => node.localName === "child");
    expect(child?.sourceRange.startOffset).toBeGreaterThanOrEqual(0);
    expect(child?.sourceRange.endOffset).toBeDefined();
    if (child?.sourceRange.endOffset !== undefined) {
      expect(xml.slice(child.sourceRange.startOffset, child.sourceRange.endOffset)).toBe(
        "<child><![CDATA[</child> decoy]]></child>",
      );
    }
  });

  it("supports redaction ranges used by delivery security", () => {
    const xml = `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="range" title="range" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <!-- </qti-correct-response> -->
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-item-body><p>Item.</p></qti-item-body>
      </qti-assessment-item>
    `;

    const result = buildQtiDeliverySafeXml(xml);
    expect(result.ok).toBe(true);
    expect(result.xml).not.toMatch(/<qti-correct-response\b/);
    expect(result.xml).not.toContain("<qti-value>A</qti-value>");
  });
});
