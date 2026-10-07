import type { QtiContentNode, QtiTestResult } from "@longsightgroup/qti3-core";
import type { QtiPlayerResolveAsset } from "../player-types.js";
import {
  projectSafeContentNodes,
  type SafeProjectedContentNode,
} from "./safe-content-projection.js";

/**
 * Parse serialized host content and reapply the canonical sanitizer after a JSON boundary.
 * Malformed structures and trees beyond 64 levels or 10,000 nodes are rejected. Unsafe
 * markup follows the same removal policy as authored content; asset resolution remains
 * host-owned. The result has no DOM or test execution dependency.
 */
export function parseSafeContentProjection(
  value: unknown,
  resolveAsset?: QtiPlayerResolveAsset,
): QtiTestResult<readonly SafeProjectedContentNode[]> {
  let remainingNodes = 10_000;
  const nodes = parseNodes(value, 0);
  return nodes
    ? { ok: true, value: projectSafeContentNodes(nodes, resolveAsset) }
    : {
        ok: false,
        diagnostics: [
          {
            code: "content.projection.invalid",
            severity: "error",
            message: "Expected a bounded text/element content tree with string attributes.",
          },
        ],
      };

  function parseNodes(input: unknown, depth: number): QtiContentNode[] | undefined {
    if (!Array.isArray(input) || depth > 64) return undefined;
    const parsed: QtiContentNode[] = [];
    for (const node of input) {
      if (--remainingNodes < 0 || !isRecord(node)) return undefined;
      if (node.kind === "text" && typeof node.text === "string") {
        parsed.push({ kind: "text", text: node.text });
        continue;
      }
      if (
        node.kind !== "element" ||
        typeof node.name !== "string" ||
        !node.name ||
        !isRecord(node.attributes)
      )
        return undefined;
      const attributes: [string, string][] = [];
      for (const [name, attribute] of Object.entries(node.attributes)) {
        if (typeof attribute !== "string") return undefined;
        attributes.push([name, attribute]);
      }
      const children = parseNodes(node.children, depth + 1);
      if (!children) return undefined;
      parsed.push({
        kind: "element",
        qtiName: node.name,
        attributes: Object.fromEntries(attributes),
        children,
      });
    }
    return parsed;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
