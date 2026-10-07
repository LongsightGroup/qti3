const commonVariants = [{ id: "accessibility-choice", kind: "accessibility" }];
const qti2Variants = [
  ...[0, 3, 3.125].flatMap((maximumScore) =>
    [false, true].map((multiple) => ({
      id: `choice-points-${multiple ? "mapped" : "matched"}-${maximumScore}`,
      kind: "choice-points",
      maximumScore,
      multiple,
    })),
  ),
  ...[
    "hotspot",
    "graphicOrder",
    "graphicAssociate",
    "graphicGapMatch",
    "positionObject",
    "selectPoint",
  ].flatMap((interaction) =>
    ["img", "picture"].map((form) => ({
      id: `${interaction}-${form}`,
      kind: "graphic-image",
      interaction,
      form,
    })),
  ),
  { id: "nested-end-attempt", kind: "nested-end-attempt" },
];

/** Variant coverage required by both the schema runner and release receipt verification. */
export function transcoderXsdVariants(target) {
  switch (target) {
    case "qti12":
      return [...commonVariants];
    case "qti21":
    case "qti22":
      return [...commonVariants, ...qti2Variants];
    default:
      throw new Error(`No XSD variants defined for target ${target}.`);
  }
}
