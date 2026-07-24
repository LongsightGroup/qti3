import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";

import { diagnostic } from "./diagnostics.js";
import { QtiMigrationBlocked } from "./repair-policy.js";
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
  const body = findDescendantByLocalName(root, "itembody");
  if (!body) {
    return {
      diagnostics: [
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
    body,
    responseDecls,
    responseDeclMap,
    sourceFormat,
    path,
    options,
    diagnostics,
  };
  const interactionCheck = resolveInteractionDispatch(body, sourceFormat, path);
  if (interactionCheck.diagnostics.length) {
    return { diagnostics: interactionCheck.diagnostics };
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
  try {
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
      return { authoringItem: mapper(context), diagnostics };
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
    return { authoringItem: mapper(dispatch.interaction, context), diagnostics };
  } catch (error) {
    if (error instanceof QtiMigrationBlocked) {
      return { diagnostics: error.diagnostics };
    }
    throw error;
  }
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
