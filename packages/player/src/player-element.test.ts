/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { defineQtiAssessmentItemPlayer, QtiAssessmentItemPlayer } from "./player-element.js";

const EMPTY_CHOICE_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="empty-choice" title="empty-choice">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-prompt>Select one.</qti-prompt>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

function validationAlerts(player: QtiAssessmentItemPlayer): HTMLElement[] {
  return [...player.querySelectorAll<HTMLElement>('[data-validation-for="RESPONSE"]')].filter(
    (element) => !element.hidden && element.textContent,
  );
}

describe("QtiAssessmentItemPlayer", () => {
  it("does not duplicate authoring validation messages after restore", async () => {
    defineQtiAssessmentItemPlayer();
    const player = document.createElement("qti-assessment-item-player") as QtiAssessmentItemPlayer;
    document.body.append(player);

    await player.loadXml(EMPTY_CHOICE_ITEM);
    expect(validationAlerts(player)).toHaveLength(1);
    expect(validationAlerts(player)[0]?.textContent).toContain("No choices are defined");

    const saved = player.serialize();
    expect(
      saved?.validationMessages.some((message) => message.code === "interaction.choices.missing"),
    ).toBe(true);

    player.restore(saved!);
    expect(validationAlerts(player)).toHaveLength(1);
    expect(
      saved?.validationMessages.filter((message) => message.code === "interaction.choices.missing"),
    ).toHaveLength(1);

    player.remove();
  });

  it("does not duplicate authoring validation messages when loading serialized state", async () => {
    defineQtiAssessmentItemPlayer();
    const player = document.createElement("qti-assessment-item-player") as QtiAssessmentItemPlayer;
    document.body.append(player);

    await player.loadXml(EMPTY_CHOICE_ITEM);
    const saved = player.serialize();
    expect(saved).toBeDefined();

    await player.loadXml(EMPTY_CHOICE_ITEM, { state: saved });
    expect(validationAlerts(player)).toHaveLength(1);
    expect(validationAlerts(player)[0]?.textContent).toContain("No choices are defined");

    player.remove();
  });
});
