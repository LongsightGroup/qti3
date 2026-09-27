import {
  createItemSession,
  parseQtiXml,
  validateAssessmentItem,
  assertQtiAttemptStateV1,
} from "@longsightgroup/qti3-core";
import { expect, it } from "vitest";
import { migrateQtiItemToQti3 } from "./index.js";

// QTI 1.2 render_choice/@shuffle, response_label/@rshuffle, conditionvar/setvar.
// Independent source program: exactly one equality condition sets SCORE to 1.
// Pinning and presentation order must never change its truth table.
const labels = ["A", "B", "C"] as const;
const cases = ["RESPONSE", "CUSTOM"].flatMap((identifier) =>
  ["Yes", "No"].flatMap((shuffle) =>
    labels.flatMap((key) => labels.map((pinned) => ({ identifier, shuffle, key, pinned }))),
  ),
);
const seeds = process.env.QTI3_EXTENDED_SEMANTICS === "1" ? 64 : 8;
it.each(cases)(
  "choice fidelity: $identifier shuffle=$shuffle key=$key pinned=$pinned",
  ({ identifier, shuffle, key, pinned }) => {
    const source = `<item ident="matrix" title="Matrix"><presentation><response_lid ident="${identifier}" rcardinality="Single"><render_choice shuffle="${shuffle}">${labels.map((id) => `<response_label ident="${id}" rshuffle="${id === pinned ? "No" : "Yes"}"><material><mattext>${id}</mattext></material></response_label>`).join("")}</render_choice></response_lid></presentation><resprocessing><respcondition continue="No"><conditionvar><varequal respident="${identifier}">${key}</varequal></conditionvar><setvar action="Set" varname="SCORE">1</setvar></respcondition></resprocessing></item>`;
    const migrated = migrateQtiItemToQti3({ xml: source });
    expect(migrated.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    if (!migrated.xml) throw new Error(`Migration failed: ${source}`);
    const parsed = parseQtiXml(migrated.xml);
    expect(parsed.diagnostics).toEqual([]);
    if (!parsed.document) throw new Error("Missing migrated document");
    expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
    const orders = new Set<string>();
    for (let seed = 0; seed < seeds; seed++) {
      for (const answer of [null, ...labels]) {
        try {
          const replay = JSON.stringify({ identifier, shuffle, key, pinned, seed, answer });
          let session = createItemSession(parsed.document, undefined, { presentationSeed: seed });
          const presentation = session.presentation();
          if (!presentation.ok) throw new Error(replay);
          expect(presentation.interactions).toHaveLength(1);
          const order = presentation.interactions.flatMap((interaction) =>
            interaction.choices.map((choice) => choice.identifier),
          );
          expect(order[labels.indexOf(pinned)]).toBe(pinned);
          expect(order.toSorted()).toEqual(labels);
          if (shuffle === "No") expect(order).toEqual(labels);
          orders.add(JSON.stringify(order));
          expect(session.respond("RESPONSE", answer)).toEqual([]);
          const saved: unknown = JSON.parse(JSON.stringify(session.serialize()));
          assertQtiAttemptStateV1(saved);
          session = createItemSession(parsed.document, saved, { presentationSeed: seed + 1000 });
          expect(session.presentation()).toEqual(presentation);
          const result = session.score();
          expect(result.diagnostics).toEqual([]);
          expect(result.outcomes.SCORE).toBe(answer === key ? 1 : 0);
        } catch (cause) {
          throw new Error(JSON.stringify({ identifier, shuffle, key, pinned, seed, answer }), {
            cause,
          });
        }
      }
    }
    expect(orders.size).toBe(shuffle === "Yes" ? 2 : 1);
  },
);
