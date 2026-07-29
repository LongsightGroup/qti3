import { readFileSync } from "node:fs";

import type { QtiInteractionType } from "@longsightgroup/qti3-core";
import {
  qti3TrustedXmlFragment,
  type Qti3PackageAuthoringInput,
  writeQti3AssessmentItem,
} from "@longsightgroup/qti3-writer";

export const choiceAuthoringPackage: Qti3PackageAuthoringInput = {
  identifier: "PACKAGE",
  title: "Transcoder package",
  items: [
    {
      kind: "authoringItem",
      path: "items/choice.xml",
      item: {
        interactionType: "choice",
        identifier: "CHOICE",
        title: "Choice",
        bodyHtml: qti3TrustedXmlFragment(
          '<p>Keep media/source.txt visible. <a href="../media/source.txt">Read the source</a></p>',
        ),
        responseCardinality: "single",
        choices: [
          { identifier: "A", text: "Alpha" },
          { identifier: "B", text: "Beta" },
        ],
        correctResponse: ["A"],
      },
      assets: [{ path: "media/source.txt", data: "source" }],
    },
  ],
};

export const vendorFixturePackage: Qti3PackageAuthoringInput = {
  identifier: "SYNTHETIC_VENDOR_EXPORT",
  title: "Synthetic vendor export fixture",
  items: [
    {
      kind: "xml",
      path: "items/choice.xml",
      identifier: "choice-reference",
      xml: fixtureXml("choice"),
    },
    {
      kind: "xml",
      path: "items/order.xml",
      identifier: "order-reference",
      xml: fixtureXml("order"),
    },
  ],
};

export function fixtureXml(interactionType: QtiInteractionType): string {
  if (interactionType === "custom") {
    return writeQti3AssessmentItem({
      interactionType: "custom",
      identifier: "custom-reference",
      title: "Custom reference",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the widget.</p>"),
      interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
    });
  }
  return readFileSync(`packages/fixtures/xml/${interactionType}-reference.xml`, "utf8");
}
