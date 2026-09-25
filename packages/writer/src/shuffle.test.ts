import { expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "@longsightgroup/qti3-core";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";

const choices = ["A", "B", "C", "D"].map((identifier) => ({
  identifier,
  text: identifier,
  fixed: identifier === "B",
}));
const base = { identifier: "writer-shuffle", title: "Shuffled choices" };
const items: Qti3AuthoringItem[] = [
  {
    ...base,
    interactionType: "choice",
    responseCardinality: "single",
    choices,
    correctResponse: ["A"],
    shuffle: true,
  },
  { ...base, interactionType: "order", choices, correctOrder: ["A", "B", "C", "D"], shuffle: true },
  {
    ...base,
    interactionType: "inlineChoice",
    bodyHtml: qti3TrustedXmlFragment(
      '<p>Select <qti-inline-choice-interaction response-identifier="RESPONSE"/>.</p>',
    ),
    slots: [
      { responseIdentifier: "RESPONSE", options: choices, correctResponse: "A", shuffle: true },
    ],
  },
  {
    ...base,
    interactionType: "associate",
    choices,
    correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "B" }],
    shuffle: true,
  },
  {
    ...base,
    interactionType: "match",
    sources: choices,
    targets: ["G1", "G2", "G3"].map((identifier) => ({ identifier, text: identifier })),
    correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "G1" }],
    shuffle: true,
  },
  {
    ...base,
    interactionType: "gapMatch",
    bodyHtml: qti3TrustedXmlFragment('<p>Fill <qti-gap identifier="G1"/>.</p>'),
    choices: choices.map(({ identifier, text }) => ({ identifier, text, kind: "text" })),
    targets: [{ identifier: "G1" }],
    correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "G1" }],
    shuffle: true,
  },
];

it.each(items)("writer $interactionType shuffle reaches a reproducible scored session", (input) => {
  const parsed = parseQtiXml(writeQti3AssessmentItem(input));
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected authored item");
  const session = createItemSession(parsed.document, undefined, { presentationSeed: 31 });
  const result = session.presentation();
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const interaction = result.interactions.at(0);
  if (!interaction) throw new Error("Expected presented interaction");
  expect(interaction.attributes.shuffle).toBe("true");
  expect(Object.keys(result.state.orders).length).toBeGreaterThan(0);
  expect(
    createItemSession(parsed.document, undefined, { presentationSeed: 31 }).presentation(),
  ).toMatchObject({ ok: true, state: result.state });
  if (input.interactionType !== "gapMatch") expect(interaction.choices[1]?.identifier).toBe("B");
  for (const declaration of parsed.document.item.responseDeclarations)
    session.respond(declaration.identifier, declaration.correctResponse);
  const scored = session.score();
  expect(scored.diagnostics).toEqual([]);
  expect(scored.outcomes.SCORE).toBe(1);
  expect(createItemSession(parsed.document, scored.state).presentation()).toMatchObject({
    ok: true,
    state: result.state,
  });
});
