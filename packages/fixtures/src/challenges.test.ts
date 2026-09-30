import { expect, it } from "vitest";
import {
  createItemSession,
  assertQtiAttemptStateV1,
  visibleModalFeedback,
} from "@longsightgroup/qti3-core";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { challengeFixtures } from "./challenges/index.js";

// Synthetic MIT inputs, literal independent answers. QTI 3.0.1 ASI §§2.7, 4.6,
// 5.88 and 7.22: template/response processing, mapping, and mapping bounds.
// https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html
// Arithmetic oracles: rectangle 3×4=12, 2(3+4)=14; readings [-3,3,6] have
// mean 2 and sum of squared deviations 42, hence sample variance 42/(3−1)=21.
for (const fixture of challengeFixtures) {
  for (const attempt of fixture.attempts) {
    it(`challenge collection: ${fixture.id}: ${attempt.name}`, () => {
      const document = validQtiDocument(fixture.xml);
      let session = createItemSession(document, undefined, {
        now: () => 0,
        presentationSeed: "original",
      });
      for (const [identifier, response] of Object.entries(attempt.responses)) {
        expect(session.respond(identifier, response)).toEqual([]);
        const saved: unknown = JSON.parse(JSON.stringify(session.serialize()));
        assertQtiAttemptStateV1(saved);
        session = createItemSession(document, saved, { now: () => 0, presentationSeed: "changed" });
      }
      const result = session.score();
      expect(result.diagnostics).toEqual([]);
      expect(result.outcomes).toMatchObject(attempt.expectedOutcomes);
      if (fixture.id === "challenge-lab-badge") {
        expect(
          visibleModalFeedback(document.item, result.outcomes).map((entry) => entry.identifier),
        ).toEqual([attempt.expectedOutcomes.BADGE]);
      }
      const saved: unknown = JSON.parse(JSON.stringify(result.state));
      assertQtiAttemptStateV1(saved);
      const restored = createItemSession(document, saved, {
        now: () => 0,
        presentationSeed: "another",
      });
      expect(restored.serialize()).toEqual(result.state);
      if (!document.item.adaptive) {
        const repeated = restored.score();
        expect(repeated.diagnostics).toEqual([]);
        expect(repeated.outcomes).toMatchObject(attempt.expectedOutcomes);
      }
    });
  }
}

it("challenge collection: mission transitions survive restoration and cannot skip or repeat stages", () => {
  const fixture = challengeFixtures.find((entry) => entry.id === "challenge-mission");
  if (!fixture) throw new Error("Missing mission fixture");
  const document = validQtiDocument(fixture.xml);
  let session = createItemSession(document, undefined, { now: () => 0 });
  for (const [responses, expected] of [
    [{ DESTINATION: "VENUS" }, { SCORE: 0, STAGE: "DESTINATION", completionStatus: "unknown" }],
    [{ DESTINATION: "MARS" }, { SCORE: 1, STAGE: "MOONS", completionStatus: "unknown" }],
    [{ MOONS: 1 }, { SCORE: 1, STAGE: "MOONS", completionStatus: "unknown" }],
    [{ MOONS: 2 }, { SCORE: 3, STAGE: "COMPLETE", completionStatus: "completed" }],
  ] as const) {
    for (const [identifier, value] of Object.entries(responses))
      expect(session.respond(identifier, value)).toEqual([]);
    const result = session.score({ endAttemptResponseIdentifier: "CHECK" });
    expect(result.diagnostics).toEqual([]);
    expect(result.outcomes).toMatchObject(expected);
    const saved: unknown = JSON.parse(JSON.stringify(result.state));
    assertQtiAttemptStateV1(saved);
    session = createItemSession(document, saved, { now: () => 0 });
    expect(session.serialize().outcomes).toMatchObject(expected);
  }
  const closed = session.serialize();
  expect(session.score().diagnostics).toEqual([
    expect.objectContaining({ code: "session.completed" }),
  ]);
  expect(session.serialize()).toEqual(closed);
});
