import { expect, it } from "vitest";
import {
  createItemSession,
  parseQtiXml,
  validateAssessmentItem,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3AuthoringItem,
} from "./index.js";

const base = { identifier: "binding", title: "Binding" };
const choices = [
  { identifier: "A", text: "Alpha" },
  { identifier: "B", text: "Beta" },
];
const object = { data: "image.png", type: "image/png", alt: "Diagram", width: 100, height: 100 };
const hotspots = [
  { identifier: "A", shape: "rect", coords: "0,0,20,20" },
  { identifier: "B", shape: "rect", coords: "30,30,50,50" },
] as const;
const pairs = [{ sourceIdentifier: "A", targetIdentifier: "B" }];
// Hand-authored answer/score oracles, not answers read back from the generated declarations.
const cases: Array<{ item: Qti3AuthoringItem; answer: QtiValue }> = [
  {
    item: {
      ...base,
      interactionType: "choice",
      choices,
      correctResponse: ["A"],
      responseCardinality: "single",
    },
    answer: "A",
  },
  {
    item: { ...base, interactionType: "order", choices, correctOrder: ["B", "A"] },
    answer: ["B", "A"],
  },
  {
    item: { ...base, interactionType: "associate", choices, correctResponse: pairs },
    answer: ["A B"],
  },
  {
    item: {
      ...base,
      interactionType: "match",
      sources: [choices[0]!],
      targets: [choices[1]!],
      correctResponse: pairs,
    },
    answer: ["A B"],
  },
  {
    item: {
      ...base,
      interactionType: "gapMatch",
      bodyHtml: qti3TrustedXmlFragment('<p>Fill <qti-gap identifier="B"/>.</p>'),
      choices: [{ identifier: "A", kind: "text", text: "Alpha" }],
      targets: [{ identifier: "B" }],
      correctResponse: pairs,
    },
    answer: ["A B"],
  },
  {
    item: {
      ...base,
      interactionType: "hottext",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-hottext identifier="A"/><qti-hottext identifier="B"/></p>',
      ),
      choices,
      correctResponse: ["A"],
      maxChoices: 1,
    },
    answer: "A",
  },
  {
    item: {
      ...base,
      interactionType: "hotspot",
      object,
      choices: hotspots,
      correctResponse: ["A"],
      maxChoices: 1,
    },
    answer: "A",
  },
  {
    item: { ...base, interactionType: "graphicOrder", object, hotspots, correctOrder: ["B", "A"] },
    answer: ["B", "A"],
  },
  {
    item: {
      ...base,
      interactionType: "graphicAssociate",
      object,
      hotspots,
      correctResponse: pairs,
    },
    answer: ["A B"],
  },
  {
    item: {
      ...base,
      interactionType: "graphicGapMatch",
      object,
      choices: [{ identifier: "A", kind: "text", text: "Alpha" }],
      targets: [hotspots[1]],
      correctResponse: pairs,
    },
    answer: ["A B"],
  },
  {
    item: { ...base, interactionType: "slider", lowerBound: 0, upperBound: 10, correctResponse: 5 },
    answer: 5,
  },
  { item: { ...base, interactionType: "upload", correctResponse: "file.txt" }, answer: "file.txt" },
  {
    item: {
      ...base,
      interactionType: "selectPoint",
      object,
      targets: [{ shape: "rect", coords: "0,0,20,20", mappedValue: 1 }],
      maxChoices: 1,
    },
    answer: "10 10",
  },
  {
    item: {
      ...base,
      interactionType: "positionObject",
      stageObject: object,
      movableObject: object,
      targets: [{ shape: "rect", coords: "0,0,20,20", mappedValue: 1 }],
      maxChoices: 1,
    },
    answer: "10 10",
  },
];
for (const responseIdentifier of ["RESPONSE", "ANSWER"]) {
  it.each(cases)(
    `${responseIdentifier} binds $item.interactionType scoring to the declared response`,
    ({ item, answer }) => {
      const written = writeQti3AssessmentItemResult({ ...item, responseIdentifier });
      expect(written.diagnostics).toEqual([]);
      if (!written.ok) throw new Error("Expected authored item");
      const parsed = parseQtiXml(written.xml);
      expect(parsed.diagnostics).toEqual([]);
      if (!parsed.document) throw new Error("Expected valid XML");
      expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
      const session = createItemSession(parsed.document);
      expect(session.score().outcomes.SCORE).toBe(0);
      session.respond(responseIdentifier, answer);
      expect(session.score().outcomes.SCORE).toBe(1);
      session.respond(responseIdentifier, null);
      expect(session.score().outcomes.SCORE).toBe(0);
    },
  );
}

// Standard map_response algorithm: NULL scores zero before mapping bounds apply.
// Inject bounds into the declaration because the choice authoring API does not expose them.
for (const responseIdentifier of ["RESPONSE", "ANSWER"]) {
  it.each([false, true])(
    `${responseIdentifier} bypasses mapping bounds for NULL with feedback=%s`,
    (withFeedback) => {
      const written = writeQti3AssessmentItemResult({
        ...base,
        interactionType: "choice",
        responseIdentifier,
        responseCardinality: "single",
        choices,
        correctResponse: ["A"],
        scoring: "map_response",
        feedback: withFeedback
          ? { entries: [{ choiceIdentifier: "A", identifier: "RIGHT", text: "Right" }] }
          : undefined,
      });
      expect(written.diagnostics).toEqual([]);
      if (!written.ok) throw new Error("Expected item");
      const parsed = parseQtiXml(
        written.xml.replace(
          '<qti-mapping default-value="0">',
          '<qti-mapping default-value="0" lower-bound="0.5">',
        ),
      );
      expect(parsed.diagnostics).toEqual([]);
      if (!parsed.document) throw new Error("Expected document");
      expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
      const session = createItemSession(parsed.document);
      expect(session.score().outcomes.SCORE).toBe(0);
      session.respond(responseIdentifier, "A");
      expect(session.score().outcomes.SCORE).toBe(1);
      session.respond(responseIdentifier, "B");
      expect(session.score().outcomes.SCORE).toBe(0.5);
      session.respond(responseIdentifier, null);
      const unanswered = session.score();
      expect(unanswered.outcomes.SCORE).toBe(0);
      if (withFeedback) expect(unanswered.outcomes.FEEDBACK).toBeNull();
    },
  );
}
