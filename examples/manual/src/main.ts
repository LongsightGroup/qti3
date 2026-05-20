import { interactionFixtures } from "@qti3/fixtures";
import { defineQtiAssessmentItemPlayer } from "@qti3/player";

defineQtiAssessmentItemPlayer();

const fixtureSelect = document.querySelector<HTMLSelectElement>("#fixture");
const loadFixture = document.querySelector<HTMLButtonElement>("#load-fixture");
const loadXml = document.querySelector<HTMLButtonElement>("#load-xml");
const xmlInput = document.querySelector<HTMLTextAreaElement>("#xml");
const events = document.querySelector<HTMLPreElement>("#events");
const player = document.querySelector("qti-assessment-item-player");

if (!fixtureSelect || !loadFixture || !loadXml || !xmlInput || !events || !player) {
  throw new Error("Manual harness failed to initialize.");
}

for (const fixture of interactionFixtures) {
  const option = document.createElement("option");
  option.value = fixture.id;
  option.textContent = `${fixture.interactionType} (${fixture.qtiName})`;
  fixtureSelect.append(option);
}

loadFixture.addEventListener("click", async () => {
  const fixture =
    interactionFixtures.find((item) => item.id === fixtureSelect.value) ?? interactionFixtures[0];
  if (!fixture) return;
  xmlInput.value = fixture.xml;
  await player.loadXml(fixture.xml);
});

loadXml.addEventListener("click", async () => {
  await player.loadXml(xmlInput.value);
});

for (const eventName of [
  "qti-ready",
  "qti-responsechange",
  "qti-score",
  "qti-statechange",
  "qti-diagnostics",
]) {
  player.addEventListener(eventName, (event) => {
    events.textContent = `${eventName}\n${JSON.stringify((event as CustomEvent).detail, null, 2)}`;
  });
}

loadFixture.click();
