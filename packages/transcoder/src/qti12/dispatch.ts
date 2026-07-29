import type { Qti12MapContext, Qti12Response } from "./types.js";
import { applyCanvasHotspotPolicy, applyCanvasPolicy } from "./canvas-policy.js";
import { manualExtendedTextQti12Response } from "./responses.js";
import type { Qti12InteractionMapper } from "./native-mappers.js";
import { NATIVE_INTERACTION_MAPPERS } from "./native-mappers.js";

/** Policy-ordered QTI 1.2 interaction dispatch after context construction. */
export function dispatchQti12Interaction(context: Qti12MapContext): Qti12Response {
  const canvasPolicy = applyCanvasPolicy(context);
  if (canvasPolicy) return canvasPolicy;

  const canvasHotspot = applyCanvasHotspotPolicy(context);
  if (canvasHotspot) return canvasHotspot;

  switch (context.policy.transformation) {
    case "extended-text-fallback":
      return manualExtendedTextQti12Response(context);
    case "matching-fallback":
    case "presentation":
      throw new Error(
        `Transformation ${context.policy.transformation} requires canvas dialect for ${context.interaction.type}`,
      );
    case "native":
    case "choice-fallback":
    case "text-entry-fallback":
      return mapNativeQti12Interaction(context);
    default: {
      const unexpected: never = context.policy;
      throw new Error(`Unsupported interaction transformation: ${JSON.stringify(unexpected)}`);
    }
  }
}

function mapNativeQti12Interaction(context: Qti12MapContext): Qti12Response {
  const mapper: Qti12InteractionMapper | undefined =
    NATIVE_INTERACTION_MAPPERS[context.interaction.type];
  if (!mapper) {
    throw new Error(
      `No native QTI 1.2 mapper for ${context.interaction.type} with transformation ${context.policy.transformation}`,
    );
  }
  return mapper(context);
}
