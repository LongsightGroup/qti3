export type SharedVocabularySupportLevel = "full" | "stylesheet" | "conditional" | "pass-through";

export type NumericComparison =
  | "less-than"
  | "greater-than"
  | "less-than-or-equal"
  | "greater-than-or-equal";

type Axis = "x" | "y";
type RelativeOrder = "before" | "after";

export type SharedVocabularyAssertion =
  | { type: "aria-snapshot-contains"; selector: string; text: string }
  | { type: "attribute"; selector: string; name: string; value: string }
  | { type: "class-preserved"; selector: string; className: string }
  | { type: "click"; selector: string }
  | { type: "computed-style"; selector: string; property: string; value: string }
  | {
      type: "computed-style-differs";
      firstSelector: string;
      secondSelector: string;
      property: string;
    }
  | {
      type: "computed-style-same";
      firstSelector: string;
      secondSelector: string;
      property: string;
    }
  | { type: "computed-style-not"; selector: string; property: string; value: string }
  | {
      type: "computed-style-number";
      selector: string;
      property: string;
      comparison: NumericComparison;
      value: number;
    }
  | { type: "dom-order"; firstSelector: string; secondSelector: string; order: RelativeOrder }
  | { type: "element-count"; selector: string; count: number }
  | { type: "focus"; selector: string }
  | { type: "forced-colors-active" }
  | { type: "hidden-focusable-input"; selector: string }
  | { type: "key"; key: string }
  | {
      type: "layout-same-row";
      firstSelector: string;
      secondSelector: string;
      tolerance: number;
    }
  | {
      type: "layout-width";
      selector: string;
      expected: number;
      tolerance: number;
    }
  | {
      type: "layout-width-ratio";
      firstSelector: string;
      secondSelector: string;
      ratio: number;
      tolerance: number;
    }
  | {
      type: "position";
      firstSelector: string;
      secondSelector: string;
      axis: Axis;
      relation: "less-than" | "greater-than";
    }
  | { type: "set-attribute"; selector: string; name: string; value: string }
  | { type: "text"; selector: string; value: string };

export interface SharedVocabularyManifestEntry {
  id: string;
  className: string | string[];
  supportLevel: SharedVocabularySupportLevel;
  fixturePath: string;
  forcedColors?: true;
  assertions: SharedVocabularyAssertion[];
}
