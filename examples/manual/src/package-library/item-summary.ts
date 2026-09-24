import {
  serializeResponseProcessing,
  type QtiAssessmentItem,
  type QtiContentNode,
  type QtiOutcomeDeclaration,
  type QtiResponseDeclaration,
  type QtiTemplateDeclaration,
  type QtiValue,
} from "@longsightgroup/qti3-core";

type Declaration = QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration;

/** Render QTI import evidence without exposing parser bookkeeping or duplicate content trees. */
export function renderItemSummary(
  container: HTMLElement,
  item: QtiAssessmentItem,
  assetHrefs: readonly string[],
): void {
  const content = document.createDocumentFragment();
  table(
    content,
    "Item",
    ["Attribute", "Value"],
    [
      ["identifier", item.identifier],
      ["title", item.title ?? "Not declared"],
      ["xml:lang", item.language ?? "Not declared"],
      [
        "adaptive",
        String(item.adaptive) + (item.attributes.adaptive === undefined ? " (default)" : ""),
      ],
      [
        "time-dependent",
        item.timeDependent === undefined ? "Not declared" : String(item.timeDependent),
      ],
      ...extraAttributes(item.attributes, [
        "identifier",
        "title",
        "xml:lang",
        "adaptive",
        "time-dependent",
      ]),
      ...extraAttributes(item.itemBodyAttributes ?? {}).map(([name, value]) => [
        `item-body ${name}`,
        value,
      ]),
    ],
  );
  declarations(content, "Responses", item.responseDeclarations, true);
  declarations(content, "Outcomes", item.outcomeDeclarations);
  for (const [index, interaction] of item.interactions.entries()) {
    const name = interaction.responseIdentifier ?? String(index + 1);
    table(
      content,
      `Interaction ${index + 1}`,
      ["Property", "Value"],
      [
        ["Element", interaction.qtiName],
        ["Response", interaction.responseIdentifier ?? "Not declared"],
        ...extraAttributes(interaction.attributes, ["response-identifier"]),
      ],
    );
    table(
      content,
      `Choices: ${name}`,
      ["Identifier", "Text", "Attributes"],
      interaction.choices.map((choice) => [
        choice.identifier,
        choice.text,
        attributeText(choice.attributes, ["identifier"]),
      ]),
    );
  }
  const processing = item.responseProcessing;
  table(
    content,
    "Response processing",
    ["Property", "Value"],
    processing
      ? [
          ["Template", processing.template ?? "None (custom processing)"],
          ["Custom rules", String(processing.rules.length || processing.conditions.length)],
          ...(processing.expressions?.length
            ? [
                [
                  "Direct expressions",
                  `${processing.expressions.length} (see Original question XML)`,
                ],
              ]
            : []),
        ]
      : [["Processing", "Not authored"]],
  );
  if (
    processing &&
    (processing.rules.length || processing.conditions.length || processing.expressions?.length)
  ) {
    const serialized = serializeResponseProcessing(processing);
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Processing rules";
    const rules = document.createElement("pre");
    rules.tabIndex = 0;
    rules.setAttribute("role", "region");
    rules.setAttribute("aria-label", "Processing rules");
    rules.textContent =
      serialized.ok && serialized.xml && !processing.expressions?.length
        ? serialized.xml
        : "These rules cannot be displayed here. Inspect Original question XML.";
    details.append(summary, rules);
    content.append(details);
  }
  if (item.templateDeclarations.length)
    declarations(content, "Template declarations", item.templateDeclarations);
  if (item.templateProcessing)
    table(
      content,
      "Template processing",
      ["Property", "Value"],
      [["Rules", `${item.templateProcessing.rules.length} (see Original question XML)`]],
    );
  const body = contentNodes(item.body);
  table(
    content,
    "Feedback",
    ["Identifier", "Outcome", "Visibility"],
    [
      ...item.modalFeedback.map((feedback) => [
        feedback.identifier,
        feedback.outcomeIdentifier,
        feedback.showHide,
      ]),
      ...body
        .filter((node) => node.kind === "feedback")
        .map((feedback) => [feedback.identifier, feedback.outcomeIdentifier, feedback.showHide]),
    ],
  );
  table(
    content,
    "Stylesheets",
    ["Href", "Attributes"],
    item.stylesheets.map((sheet) => [sheet.href, attributeText(sheet.attributes, ["href"])]),
  );
  table(
    content,
    "Package assets",
    ["Path"],
    assetHrefs.map((href) => [href]),
  );
  table(
    content,
    "Media and accessibility attributes",
    ["Element", "Attributes"],
    body
      .filter((node) => node.kind === "element")
      .filter(
        (node) =>
          "src" in node.attributes ||
          "data" in node.attributes ||
          Object.keys(node.attributes).some((name) => name === "role" || name.startsWith("aria-")),
      )
      .map((node) => [node.qtiName, attributeText(node.attributes)]),
  );
  table(
    content,
    "Accessibility catalogs",
    ["ID", "Support"],
    (item.catalogInfo?.catalogs ?? []).map((catalog) => [
      catalog.id,
      catalog.cards
        .map((card) => `${card.support}${card.language ? ` (${card.language})` : ""}`)
        .join(", "),
    ]),
  );
  container.replaceChildren(content);
}

function declarations(
  parent: ParentNode,
  caption: string,
  entries: readonly Declaration[],
  responses = false,
): void {
  table(
    parent,
    caption,
    [
      "Identifier",
      "Cardinality / base type",
      "Default value",
      ...(responses ? ["Correct response"] : []),
    ],
    entries.map((entry) => [
      entry.identifier,
      `${entry.cardinality} / ${entry.baseType ?? "not declared"}`,
      valueText(entry.defaultValue),
      ...(responses && "correctResponse" in entry ? [valueText(entry.correctResponse)] : []),
    ]),
  );
  for (const entry of entries) {
    table(
      parent,
      `Attributes: ${entry.identifier}`,
      ["Attribute", "Value"],
      extraAttributes(entry.attributes, ["identifier", "cardinality", "base-type"]),
    );
    if ("mapping" in entry && entry.mapping) {
      const mapping = entry.mapping;
      table(
        parent,
        `Mapping bounds: ${entry.identifier}`,
        ["Default", "Lower bound", "Upper bound"],
        [
          [
            String(mapping.defaultValue),
            mapping.attributes["lower-bound"] ?? "Not set",
            mapping.attributes["upper-bound"] ?? "Not set",
          ],
        ],
      );
      table(
        parent,
        `Mapping: ${entry.identifier}`,
        ["Key", "Mapped value", "Attributes"],
        mapping.entries.map((mapped) => [
          mapped.mapKey ?? "Not declared",
          String(mapped.mappedValue),
          attributeText(mapped.attributes, ["map-key", "mapped-value"]),
        ]),
      );
    }
    if ("areaMapping" in entry && entry.areaMapping) {
      const mapping = entry.areaMapping;
      table(
        parent,
        `Area mapping: ${entry.identifier}`,
        ["Attribute", "Value"],
        extraAttributes(mapping.attributes),
      );
      table(
        parent,
        `Areas: ${entry.identifier}`,
        ["Shape", "Coordinates", "Mapped value"],
        mapping.entries.map((area) => [
          area.shape,
          area.coords.join(", "),
          String(area.mappedValue),
        ]),
      );
    }
    if ("lookupTable" in entry && entry.lookupTable) {
      const lookup = entry.lookupTable;
      table(
        parent,
        `Lookup: ${entry.identifier}`,
        ["Type", "Default value"],
        [[lookup.type, valueText(lookup.defaultValue)]],
      );
      table(
        parent,
        `Lookup entries: ${entry.identifier}`,
        ["Source", "Target", "Attributes"],
        lookup.entries.map((row) => [
          String(row.sourceValue),
          valueText(row.targetValue),
          attributeText(row.attributes, ["source-value", "target-value"]),
        ]),
      );
    }
  }
}

function valueText(value: QtiValue): string {
  return value === null ? "NULL" : JSON.stringify(value);
}

function extraAttributes(
  attributes: Readonly<Record<string, string>>,
  excluded: readonly string[] = [],
): [string, string][] {
  return Object.entries(attributes).filter(
    ([name]) =>
      !excluded.includes(name) &&
      name !== "xmlns" &&
      !name.startsWith("xmlns:") &&
      !name.endsWith(":schemaLocation"),
  );
}

function attributeText(
  attributes: Readonly<Record<string, string>>,
  excluded: readonly string[] = [],
): string {
  return (
    extraAttributes(attributes, excluded)
      .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
      .join("; ") || "—"
  );
}

function contentNodes(nodes: readonly QtiContentNode[]): QtiContentNode[] {
  return nodes.flatMap((node) => [
    node,
    ...("children" in node ? contentNodes(node.children) : []),
  ]);
}

function table(
  parent: ParentNode,
  caption: string,
  headings: readonly string[],
  rows: readonly (readonly string[])[],
): void {
  if (!rows.length) return;
  const element = document.createElement("table");
  element.createCaption().textContent = caption;
  const header = element.createTHead().insertRow();
  for (const heading of headings) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = heading;
    header.append(cell);
  }
  const body = element.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    for (const value of row) tr.insertCell().textContent = value;
  }
  parent.append(element);
}
