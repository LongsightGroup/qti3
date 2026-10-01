interface ChallengeGuide {
  rules: string;
  examples: readonly string[];
}

const guides: Readonly<Record<string, ChallengeGuide>> = {
  "challenge-garden": {
    rules: "Area earns 2 points and perimeter earns 1. Total: 0–3 points.",
    examples: ["Area 12 and perimeter 14: 3 points.", "Area 12 alone: 2 points."],
  },
  "challenge-sensor": {
    rules:
      "A reading above 99.5 and at most 101 earns 2 points; Celsius earns 1. A reading of exactly 99.5 earns no measurement points.",
    examples: ["99.5 and Celsius: 1 point.", "101 and Celsius: 3 points."],
  },
  "challenge-flight-order": {
    rules: "Each stage in its correct position earns 1 point. Total: 0–4 points.",
    examples: [
      "Ignition, Liftoff, Enter orbit, Landing: 4 points.",
      "Ignition, Enter orbit, Liftoff, Landing: 2 points.",
      "Landing, Enter orbit, Liftoff, Ignition: 0 points.",
    ],
  },
  "challenge-planet-types": {
    rules:
      "Mercury → Rocky planet earns 3 points, Venus → Rocky planet earns 2, and Jupiter → Gas giant earns 4. Each incorrect match loses 2 points. There is no floor at zero.",
    examples: [
      "Mercury and Venus → Rocky planet; Jupiter → Gas giant: 9 points.",
      "Mercury → Gas giant alone: −2 points.",
    ],
  },
  "challenge-water-cycle": {
    rules:
      "Each correct gap earns 1 point; each incorrect assignment loses 1. Empty gaps earn 0. You may use water twice.",
    examples: ["water, water vapor, water: 3 points.", "water, ice, water: 1 point."],
  },
  "challenge-unicode": {
    rules:
      "Co earns 2 points and requires exact capitalization. Québec earns 1 point with any capitalization, but the accent is required. Extra spaces make either answer incorrect.",
    examples: ["Co and QUÉBEC: 3 points.", "CO and Québec: 1 point."],
  },
  "challenge-target": {
    rules:
      "The centre circle earns 2 points and takes priority over the surrounding square, which earns 1. Each region scores only once. A miss loses 1 point.",
    examples: [
      "One shot in the centre circle and one in the surrounding square: 3 points.",
      "Two shots in the circle: 2 points.",
    ],
  },
  "challenge-lab-badge": {
    rules:
      "Above 80 earns gold; 50 through 80 earns silver; below 50 shows retry feedback. SCORE records the entered result.",
    examples: ["80: silver.", "80.001: gold.", "49.99: retry."],
  },
  "challenge-weather-statistics": {
    rules:
      "The correct mean earns 1 point and sample variance earns 2. For −3, 3, and 6, the mean is 2 and sample variance is 42 ÷ 2 = 21.",
    examples: [
      "Mean 2 and sample variance 21: 3 points.",
      "Mean 2 and population variance 14: 1 point.",
    ],
  },
  "challenge-mission": {
    rules:
      "Use Check mission inside the question to advance each stage. The second stage retains the first stage's point; completion locks the answer.",
    examples: [
      "Choose Mars and check: 1 point and stage two opens.",
      "Then enter 2 moons and check: 3 points and completed.",
    ],
  },
};

/** Show independent example answers for the currently loaded challenge. */
export function renderChallengeGuide(
  itemIdentifier: string | undefined,
  outcomes?: Record<string, unknown>,
): void {
  const section = document.querySelector<HTMLElement>("#challenge-guide");
  const rules = document.querySelector<HTMLElement>("#challenge-rules");
  const examples = document.querySelector<HTMLElement>("#challenge-examples");
  const result = document.querySelector<HTMLElement>("#challenge-result");
  if (!section || !rules || !examples || !result) return;
  const guide =
    itemIdentifier && Object.hasOwn(guides, itemIdentifier) ? guides[itemIdentifier] : undefined;
  section.hidden = !guide;
  result.textContent = "";
  if (!guide) return;
  rules.textContent = guide.rules;
  examples.replaceChildren(
    ...guide.examples.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }),
  );
  if (!outcomes) return;
  if (itemIdentifier === "challenge-flight-order" && typeof outcomes.SCORE === "number") {
    result.textContent = `${outcomes.SCORE} of 4 stages are in the correct position.`;
  } else if (itemIdentifier === "challenge-lab-badge" && typeof outcomes.BADGE === "string") {
    result.textContent = `Result badge: ${outcomes.BADGE.toLowerCase()}.`;
  } else if (typeof outcomes.SCORE === "number") {
    result.textContent = `This answer earned ${outcomes.SCORE} points.${outcomes.completionStatus === "completed" ? " Mission completed." : ""}`;
  }
}
