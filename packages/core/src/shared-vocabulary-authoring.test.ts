import { describe, expect, it } from "vitest";
import {
  describeSharedVocabularyPrecedence,
  parseSharedVocabularyAttributes,
  parseSharedVocabularyClasses,
  serializeSharedVocabularyAttributes,
  serializeSharedVocabularyClassNames,
  sharedVocabularyFieldById,
  sharedVocabularyFieldsForInteraction,
  sharedVocabularyInteractionFields,
  type QtiSharedVocabularyField,
} from "./index.js";
import { assertNever } from "./assert-never.js";
import { sharedVocabularyClassSupport } from "./shared-vocabulary-support.js";

const issueFieldIds = [
  "labels-style",
  "labels-suffix",
  "orientation",
  "choices-stacking",
  "choices-position",
  "selections-tone",
  "writing-orientation",
  "input-control-hidden",
  "unselected-hidden",
  "match-tabular",
  "header-hidden",
  "gap-placement",
  "choices-container-width",
  "first-column-header",
  "media-player-controls",
  "media-player-pause-delay",
  "media-player-pause-duration",
];

describe("shared vocabulary authoring", () => {
  it("exposes one descriptor for every issue 11 initial field", () => {
    expect(sharedVocabularyInteractionFields.map((field) => field.id)).toEqual(issueFieldIds);
  });

  it("keeps class and attribute descriptors aligned with support metadata", () => {
    const supportByName = new Map(
      sharedVocabularyClassSupport.map((entry) => [entry.className, entry]),
    );
    const failures: string[] = [];

    for (const field of sharedVocabularyInteractionFields) {
      for (const name of expandedSupportNames(field)) {
        const support = supportByName.get(name);
        if (support === undefined) {
          failures.push(`${name}: missing support metadata`);
          continue;
        }
        if (support.scope !== "interaction") {
          failures.push(`${name}: expected interaction scope, got ${support.scope}`);
        }
        if (!sameValues(support.interactions ?? [], field.interactions)) {
          failures.push(
            `${name}: expected interactions ${formatValues(field.interactions)}, got ${formatValues(
              support.interactions ?? [],
            )}`,
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("filters fields by interaction", () => {
    const choiceFieldIds = sharedVocabularyFieldsForInteraction("choice").map((field) => field.id);

    expect(choiceFieldIds).toEqual([
      "labels-style",
      "labels-suffix",
      "orientation",
      "choices-stacking",
      "selections-tone",
      "writing-orientation",
      "input-control-hidden",
      "unselected-hidden",
    ]);
    expect(choiceFieldIds).not.toContain("match-tabular");
    expect(sharedVocabularyFieldsForInteraction("match").map((field) => field.id)).toContain(
      "first-column-header",
    );
    expect(sharedVocabularyFieldsForInteraction("choice").map((field) => field.id)).not.toContain(
      "first-column-header",
    );
  });

  it("round-trips every class value and fixed class field", () => {
    for (const field of sharedVocabularyInteractionFields) {
      if (field.kind === "attribute") continue;
      const values = field.kind === "class-fixed" ? [true] : field.values;

      for (const value of values) {
        const state = { [field.id]: value };
        const classNames = serializeSharedVocabularyClassNames(state);
        const roundTripped = parseSharedVocabularyClasses(classNames.join(" "));

        expect(roundTripped[field.id]).toBe(value);
      }
    }
  });

  it("round-trips media shared vocabulary attributes", () => {
    const state = {
      "media-player-controls": ["play", "captions", "audioDescription"],
      "media-player-pause-delay": 0.25,
      "media-player-pause-duration": 1.5,
    };

    const attrs = serializeSharedVocabularyAttributes(state, "media");

    expect(attrs).toEqual({
      "data-qti-media-player-controls": "play captions audioDescription",
      "data-qti-media-player-pause-delay": "0.25",
      "data-qti-media-player-pause-duration": "1.5",
    });
    expect(parseSharedVocabularyAttributes(attrs, "media")).toEqual(state);
  });

  it("round-trips choices layout and tabular match shared vocabulary attributes", () => {
    expect(
      serializeSharedVocabularyAttributes(
        {
          "choices-container-width": 160,
          "first-column-header": "Source",
        },
        "match",
      ),
    ).toEqual({
      "data-choices-container-width": "160",
      "data-first-column-header": "Source",
    });

    expect(
      parseSharedVocabularyAttributes(
        {
          "data-choices-container-width": "160",
          "data-first-column-header": "Source",
        },
        "match",
      ),
    ).toEqual({
      "choices-container-width": 160,
      "first-column-header": "Source",
    });
  });

  it("describes registry precedence for value-order and class-order fields", () => {
    const labelsStyle = sharedVocabularyFieldById("labels-style");
    const choicesPosition = sharedVocabularyFieldById("choices-position");
    expect(labelsStyle?.kind).toBe("class-value");
    expect(choicesPosition?.kind).toBe("class-value");
    if (labelsStyle?.kind !== "class-value" || choicesPosition?.kind !== "class-value") {
      throw new Error("expected class-value fields");
    }

    expect(
      describeSharedVocabularyPrecedence(labelsStyle, [
        "qti-labels-upper-alpha",
        "qti-labels-decimal",
        "qti-labels-none",
      ]),
    ).toBe("qti-labels-none takes precedence over qti-labels-decimal, then qti-labels-upper-alpha");
    expect(
      describeSharedVocabularyPrecedence(choicesPosition, ["qti-choices-right", "qti-choices-top"]),
    ).toBe("qti-choices-right takes precedence over qti-choices-top");
  });

  it("matches existing runtime precedence for conflicting value classes", () => {
    expect(
      parseSharedVocabularyClasses(
        "qti-labels-upper-alpha qti-labels-decimal qti-labels-none",
        "choice",
      ),
    ).toMatchObject({ "labels-style": "none" });
    expect(
      parseSharedVocabularyClasses(
        "qti-labels-suffix-parenthesis qti-labels-suffix-period qti-labels-suffix-none",
        "choice",
      ),
    ).toMatchObject({ "labels-suffix": "none" });
    expect(
      parseSharedVocabularyClasses("qti-orientation-vertical qti-orientation-horizontal", "choice"),
    ).toMatchObject({ orientation: "horizontal" });
    expect(
      parseSharedVocabularyClasses("qti-choices-right qti-choices-top", "order"),
    ).toMatchObject({ "choices-position": "right" });
    expect(
      parseSharedVocabularyClasses("qti-choices-stacking-4 qti-choices-stacking-2", "choice"),
    ).toMatchObject({ "choices-stacking": 4 });
  });

  it("omits invalid, empty, and unsupported serialized values", () => {
    expect(
      serializeSharedVocabularyClassNames(
        {
          "labels-style": "roman",
          "input-control-hidden": false,
          "match-tabular": true,
        },
        "choice",
      ),
    ).toEqual([]);

    expect(
      serializeSharedVocabularyAttributes(
        {
          "choices-container-width": 0,
        },
        "match",
      ),
    ).toEqual({});

    expect(
      serializeSharedVocabularyAttributes(
        {
          "media-player-controls": ["play", "speed", "captions"],
          "media-player-pause-delay": -1,
        },
        "media",
      ),
    ).toEqual({ "data-qti-media-player-controls": "play captions" });
  });

  it("rejects invalid choices-container-width attribute values during parse", () => {
    expect(
      parseSharedVocabularyAttributes(
        {
          "data-choices-container-width": "0",
        },
        "match",
      ),
    ).toEqual({});
    expect(
      parseSharedVocabularyAttributes(
        {
          "data-choices-container-width": "-1",
        },
        "order",
      ),
    ).toEqual({});
    expect(
      parseSharedVocabularyAttributes(
        {
          "data-choices-container-width": "wide",
        },
        "gapMatch",
      ),
    ).toEqual({});
    expect(
      parseSharedVocabularyAttributes(
        {
          "data-choices-container-width": "",
        },
        "graphicGapMatch",
      ),
    ).toEqual({});
  });

  it("parses only supported attributes and tokens", () => {
    expect(
      parseSharedVocabularyAttributes(
        {
          "data-qti-media-player-controls": "play speed captions play",
          "data-qti-media-player-pause-delay": "0",
          "data-qti-media-player-pause-duration": "2",
        },
        "media",
      ),
    ).toEqual({
      "media-player-controls": ["play", "captions"],
      "media-player-pause-delay": 0,
      "media-player-pause-duration": 2,
    });
  });
});

function expandedSupportNames(field: QtiSharedVocabularyField): string[] {
  switch (field.kind) {
    case "class-value":
      return field.values.map((value) => `${field.classPrefix}${String(value)}`);
    case "class-fixed":
      return [field.className];
    case "attribute":
      return [field.attributeName];
    default:
      return assertNever(field);
  }
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return formatValues(left) === formatValues(right);
}

function formatValues(values: readonly string[]): string {
  return [...values].toSorted().join(", ");
}
