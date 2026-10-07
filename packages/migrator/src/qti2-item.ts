import { xmlBooleanAttribute } from "./xml-boolean.js";
import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";

import { diagnostic } from "./diagnostics.js";
import { collectInteractionElements } from "./qti2-body.js";
import { type Qti2Context } from "./qti2-context.js";
import {
  qti2InteractionMappers,
  qti2ItemMappers,
  qti2MultiSlotInteractionNames,
  supportedQti2InteractionNames,
} from "./qti2-interactions.js";
import { normalizeIdentifier, stripTags } from "./text.js";
import type {
  QtiMigrationDiagnostic,
  QtiMigrationSourceFormat,
  ResolvedQtiMigrationOptions,
} from "./types.js";
import {
  attr,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  localName,
  parseXml,
  serializeChildren,
  textOf,
  type XmlElement,
} from "./xml.js";

export type { Qti2Context } from "./qti2-context.js";

type InteractionDispatch =
  | { readonly kind: "item"; readonly interactionName: string }
  | { readonly kind: "interaction"; readonly interaction: XmlElement };

export function migrateQti2ItemXml(
  xml: string,
  path: string,
  sourceFormat: QtiMigrationSourceFormat,
  options: ResolvedQtiMigrationOptions,
): {
  authoringItem?: Qti3AuthoringItem | undefined;
  diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const diagnostics: QtiMigrationDiagnostic[] = [];
  const doc = parseXml(xml, path);
  const root = doc.documentElement;
  if (localName(root) !== "assessmentitem") {
    return {
      diagnostics: [
        diagnostic("qti2_item_root", "error", "Expected QTI 2.x assessmentItem root.", {
          path,
          sourceFormat,
        }),
      ],
    };
  }
  // The writer currently emits non-adaptive items only. Never downgrade an adaptive source.
  if (xmlBooleanAttribute(attr(root, "adaptive"))) {
    diagnostics.push(
      diagnostic(
        "qti2_adaptive_not_preserved",
        "error",
        "Adaptive QTI 2 item lifecycle semantics cannot be preserved by the authoring model.",
        { path, sourceFormat },
      ),
    );
  }
  const body = findDescendantByLocalName(root, "itembody");
  if (!body) {
    return {
      diagnostics: [
        ...diagnostics,
        diagnostic("qti2_item_body_missing", "error", "QTI 2.x item is missing itemBody.", {
          path,
          sourceFormat,
        }),
      ],
    };
  }
  const responseDecls = findAllDescendantsByLocalName(root, "responsedeclaration");
  const responseDeclMap = new Map<string, XmlElement>();
  for (const declaration of responseDecls) {
    const identifier = attr(declaration, "identifier");
    if (identifier) responseDeclMap.set(identifier, declaration);
  }
  const context: Qti2Context = {
    identifier: normalizeIdentifier(attr(root, "identifier"), "ITEM"),
    title: attr(root, "title")?.trim() || "Imported Item",
    lang: attr(root, "xml:lang") ?? undefined,
    body,
    responseDecls,
    responseDeclMap,
    maximumScore: explicitMaximumScore(root),
    sourceFormat,
    path,
    options,
    diagnostics,
  };
  const interactionCheck = resolveInteractionDispatch(body, sourceFormat, path);
  if (interactionCheck.diagnostics.length || diagnostics.length) {
    return { diagnostics: [...diagnostics, ...interactionCheck.diagnostics] };
  }
  const dispatch = interactionCheck.dispatch;
  if (!dispatch) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_interaction_unsupported",
          "error",
          "No supported QTI 2.x interaction found.",
          {
            path,
            sourceFormat,
          },
        ),
      ],
    };
  }
  if (dispatch.kind === "item") {
    const mapper = qti2ItemMappers[dispatch.interactionName];
    if (!mapper) {
      return {
        diagnostics: [
          diagnostic(
            "qti2_interaction_unsupported",
            "error",
            `Unsupported QTI 2.x interaction ${dispatch.interactionName}.`,
            { path, sourceFormat },
          ),
        ],
      };
    }
    const authoringItem = mapper(context);
    return finishQti2ItemMigration(context, authoringItem, diagnostics);
  }
  const mapper = qti2InteractionMappers[localName(dispatch.interaction)];
  if (!mapper) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_interaction_unsupported",
          "error",
          `Unsupported QTI 2.x interaction ${localName(dispatch.interaction)}.`,
          { path, sourceFormat },
        ),
      ],
    };
  }
  const authoringItem = mapper(dispatch.interaction, context);
  return finishQti2ItemMigration(context, authoringItem, diagnostics);
}

// A candidate authoring value only. finalizeItemResult rejects any processing or
// outcome difference, so maximum metadata never substitutes for the actual score program.
function explicitMaximumScore(root: XmlElement): number | undefined {
  const declarations = findAllDescendantsByLocalName(root, "outcomedeclaration").filter(
    (entry) => attr(entry, "identifier") === "MAXSCORE",
  );
  if (declarations.length !== 1) return undefined;
  const declaration = declarations[0];
  if (attr(declaration, "cardinality") !== "single" || attr(declaration, "baseType") !== "float") {
    return undefined;
  }
  const defaultValue = findDescendantByLocalName(declaration, "defaultvalue");
  const values = findAllDescendantsByLocalName(defaultValue, "value");
  if (values.length !== 1) return undefined;
  const raw = textOf(values[0]);
  if (raw === "") return undefined;
  const maximum = Number(raw);
  return Number.isFinite(maximum) && maximum >= 0 ? maximum : undefined;
}

function finishQti2ItemMigration(
  context: Qti2Context,
  authoringItem: Qti3AuthoringItem | undefined,
  diagnostics: QtiMigrationDiagnostic[],
): {
  authoringItem?: Qti3AuthoringItem | undefined;
  diagnostics: readonly QtiMigrationDiagnostic[];
} {
  if (context.blocked) return { diagnostics: context.blocked };
  if (!authoringItem) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_migration_internal",
          "error",
          "QTI 2.x mapper completed without an item or repair block.",
          { path: context.path, sourceFormat: context.sourceFormat },
        ),
      ],
    };
  }
  return { authoringItem: { ...authoringItem, lang: context.lang }, diagnostics };
}

function resolveInteractionDispatch(
  root: XmlElement,
  sourceFormat: QtiMigrationSourceFormat,
  path: string,
): {
  readonly dispatch?: InteractionDispatch | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const interactions = collectInteractionElements(root);
  const unsupported = interactions.filter(
    (interaction) => !supportedQti2InteractionNames.has(localName(interaction)),
  );
  if (unsupported.length) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_interaction_unsupported",
          "error",
          `Unsupported QTI 2.x interaction ${localName(unsupported[0])}.`,
          { path, sourceFormat },
        ),
      ],
    };
  }
  const supported = interactions.filter((interaction) =>
    supportedQti2InteractionNames.has(localName(interaction)),
  );
  if (!supported.length) {
    return { diagnostics: [] };
  }
  const supportedNames = new Set(supported.map((interaction) => localName(interaction)));
  const isMultiSlotItem =
    supportedNames.size === 1 && qti2MultiSlotInteractionNames.has([...supportedNames][0]!);
  if (supported.length > 1 && !isMultiSlotItem) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_composite_interactions_unsupported",
          "error",
          "QTI 2.x item contains multiple interactions; partial migration is not allowed.",
          { path, sourceFormat },
        ),
      ],
    };
  }
  if (isMultiSlotItem) {
    return {
      dispatch: { kind: "item", interactionName: [...supportedNames][0]! },
      diagnostics: [],
    };
  }
  return { dispatch: { kind: "interaction", interaction: supported[0]! }, diagnostics: [] };
}

export function itemTitleFromXml(xml: string): string {
  const doc = parseXml(xml, "item-title");
  const root = doc.documentElement;
  return (
    attr(root, "title")?.trim() ||
    stripTags(serializeChildren(root)).slice(0, 40) ||
    "Imported Item"
  );
}
