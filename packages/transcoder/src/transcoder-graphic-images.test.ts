import { describe, expect, it } from "vitest";
import { parseQtiXml } from "@longsightgroup/qti3-core";
import { transcodeQti3Item } from "./index.js";
import { fixtureXml } from "./transcoder.test-helpers.js";

const graphicTypes = [
  "hotspot",
  "graphicOrder",
  "graphicAssociate",
  "graphicGapMatch",
  "positionObject",
  "selectPoint",
] as const;

function imageVariant(type: (typeof graphicTypes)[number], responsive: boolean): string {
  return fixtureXml(type).replace(/<object\s[^>]*\/>/g, (object) => {
    const image = object
      .replace("<object", "<img")
      .replace(" data=", " src=")
      .replace("/>", ' alt="Workflow"/>');
    return responsive
      ? `<picture><source srcset="small.webp 1x, large.webp 2x" type="image/webp"/>${image}</picture>`
      : image;
  });
}

for (const profile of [
  "qti21-standard@1",
  "qti22-standard@1",
  "blackboard-question-banks@1",
  "brightspace-course-import@1",
] as const) {
  describe(`graphic image projection for ${profile}`, () => {
    for (const type of graphicTypes) {
      it.each([false, true])(
        `exports ${type} with responsive=%s as a legacy object`,
        (responsive) => {
          const xml = imageVariant(type, responsive);
          const parsed = parseQtiXml(xml);
          expect(parsed.ok).toBe(true);
          const interaction = parsed.document?.item.interactions[0];
          if (!interaction?.object?.data) throw new Error("Expected graphic asset");
          const result = transcodeQti3Item({ kind: "xml", xml }, { profile });
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.xml).toContain(`<object data="${interaction.object.data}"`);
          expect(result.xml).toContain("Workflow</object>");
          expect(result.xml).not.toMatch(/<(picture|source|img)\b/);
          expect(result.xml).not.toContain("srcset=");
          if (interaction.positionObjectStage?.data) {
            expect(result.xml).toContain(`<object data="${interaction.positionObjectStage.data}"`);
          }
          const warnings = result.diagnostics.filter(
            (entry) => entry.code === "target.image.responsive_sources_omitted",
          );
          expect(warnings).toHaveLength(responsive ? (type === "positionObject" ? 2 : 1) : 0);
          if (responsive) {
            expect(result.fidelity).toBe("lossy");
            expect(result.report.mappings[0]?.fidelity).toBe("lossy");
            expect(result.report.mappings[0]?.diagnosticCodes).toContain(
              "target.image.responsive_sources_omitted",
            );
          }
        },
      );
    }
  });
}

it("reports responsive selection loss for an img srcset without picture sources", () => {
  const xml = imageVariant("hotspot", false).replace(
    "<img ",
    '<img srcset="small.webp 1x, large.webp 2x" ',
  );
  const result = transcodeQti3Item({ kind: "xml", xml }, { profile: "qti22-standard@1" });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.fidelity).toBe("lossy");
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: "target.image.responsive_sources_omitted",
      severity: "warning",
    }),
  );
});
