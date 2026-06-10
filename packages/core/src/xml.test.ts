import { describe, expect, it } from "vitest";
import { buildQtiDeliverySafeXml } from "./delivery-security.js";
import { parseQtiXml } from "./parser.js";
import { parseXmlTree, textContent } from "./xml.js";

describe("parseXmlTree source ranges", () => {
  it("preserves boundary whitespace around inline child elements", () => {
    const xml = "<p>Note: The <em>orientation</em> of the layout.</p>";

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);

    const paragraph = parsed.root;
    expect(paragraph?.content).toEqual([
      "Note: The ",
      expect.objectContaining({ localName: "em" }),
      " of the layout.",
    ]);
  });

  it("does not restore XML comments as mixed-content text", () => {
    const xml = `<qti-simple-choice><div>Visible</div><!-- <div>hidden</div> --><div>Text</div></qti-simple-choice>`;

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);

    expect(textContent(parsed.root!)).toBe("Visible Text");
    expect(parsed.root?.content).toEqual([
      expect.objectContaining({ localName: "div" }),
      expect.objectContaining({ localName: "div" }),
    ]);
  });

  it("decodes numeric character references in parsed text", () => {
    const xml = "<math><mrow><mi>&#x398;</mi><mi>&#x03B6;</mi><mi>&amp;#x398;</mi></mrow></math>";

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);

    const identifiers = parsed.root?.children[0]?.children ?? [];
    expect(identifiers.map((node) => node.text)).toEqual(["Θ", "ζ", "&#x398;"]);
  });

  it("records exact ranges for nested same-name elements", () => {
    const xml = `<root><item id="outer"><item id="inner">inner</item></item></root>`;

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);

    const outer = parsed.root?.children[0];
    const inner = outer?.children[0];
    expect(sourceSlice(xml, outer)).toBe(`<item id="outer"><item id="inner">inner</item></item>`);
    expect(sourceSlice(xml, inner)).toBe(`<item id="inner">inner</item>`);
  });

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

  it("ignores decoy closing tags in processing instructions", () => {
    const xml = `<root><child><?decoy </child> ?>content</child></root>`;

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);

    const child = parsed.root?.children[0];
    expect(sourceSlice(xml, child)).toBe(`<child><?decoy </child> ?>content</child>`);
  });

  it("records self-closing ranges and ignores quoted tag terminators", () => {
    const xml = `<root><leaf data="A > B"/></root>`;

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);

    const leaf = parsed.root?.children[0];
    expect(sourceSlice(xml, leaf)).toBe(`<leaf data="A > B"/>`);
  });

  it("records ranges for prefixed elements using raw qualified names", () => {
    const xml = `<qti:root xmlns:qti="urn:test"><qti:item qti:label="A > B">Value</qti:item></qti:root>`;

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);

    const item = parsed.root?.children[0];
    expect(item?.name).toBe("qti:item");
    expect(item?.localName).toBe("item");
    expect(sourceSlice(xml, item)).toBe(`<qti:item qti:label="A > B">Value</qti:item>`);
  });

  it("records ranges when a doctype declaration precedes the root element", () => {
    const xml = `<!DOCTYPE qti-assessment-item [
      <!ENTITY decoy "</qti-response-processing>">
    ]><qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="doctype" title="doctype" time-dependent="false"><qti-item-body><p>Doctype.</p></qti-item-body></qti-assessment-item>`;

    const parsed = parseXmlTree(xml);
    expect(parsed.errors).toEqual([]);
    expect(parsed.root?.name).toBe("qti-assessment-item");
    expect(sourceSlice(xml, parsed.root)).toBe(
      `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="doctype" title="doctype" time-dependent="false"><qti-item-body><p>Doctype.</p></qti-item-body></qti-assessment-item>`,
    );
  });

  it("treats XML parse errors as fatal instead of returning a partial QTI document", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="partial" title="partial" time-dependent="false">
        <qti-item-body><p>Partial.</p></qti-item-body>
    `);

    expect(result.ok).toBe(false);
    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "xml.parse", severity: "error" }),
    );
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

function sourceSlice(
  xml: string,
  node: ReturnType<typeof parseXmlTree>["root"],
): string | undefined {
  if (!node || node.sourceRange.endOffset === undefined) return undefined;
  return xml.slice(node.sourceRange.startOffset, node.sourceRange.endOffset);
}
