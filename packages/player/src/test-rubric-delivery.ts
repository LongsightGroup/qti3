import type { QtiTestRubricBlock } from "@longsightgroup/qti3-core";
import {
  projectSafeContentNodes,
  type SafeProjectedContentNode,
} from "./content/safe-content-projection.js";
import type { QtiPlayerResolveAsset } from "./player-types.js";

/** Candidate-visible static rubric markup with its unchanged authored scope. */
export interface QtiTestRubricDelivery {
  readonly scopeType: QtiTestRubricBlock["scopeType"];
  readonly scopeIdentifier: string;
  readonly content: readonly SafeProjectedContentNode[];
}

/**
 * Project validated static test rubrics for candidate delivery through the shared sanitizer.
 * Other audiences never enter the returned tree. Hosts display each block at its authored
 * scope; this API does not insert rubrics into an item or select a test execution engine.
 */
export function createCandidateTestRubricDelivery(
  blocks: readonly QtiTestRubricBlock[],
  resolveAsset?: QtiPlayerResolveAsset,
): readonly QtiTestRubricDelivery[] {
  return blocks.flatMap((block) =>
    block.node.attributes.view?.split(/\s+/).includes("candidate")
      ? [
          {
            scopeType: block.scopeType,
            scopeIdentifier: block.scopeIdentifier,
            content: projectSafeContentNodes([block.node], resolveAsset),
          },
        ]
      : [],
  );
}
