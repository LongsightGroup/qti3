import type { QtiDiagnostic, QtiStylesheet } from "@longsightgroup/qti3-core";
import type { QtiPlayerResolveStylesheet, QtiResolvedStylesheet } from "../player-types.js";

export interface QtiPlayerStylesheetResolution {
  links: QtiResolvedStylesheet[];
  diagnostics: QtiDiagnostic[];
}

export function resolvePlayerStylesheets(
  stylesheets: QtiStylesheet[],
  resolveStylesheet: QtiPlayerResolveStylesheet | undefined,
): QtiPlayerStylesheetResolution {
  if (!resolveStylesheet) return { links: [], diagnostics: [] };

  const links: QtiResolvedStylesheet[] = [];
  const diagnostics: QtiDiagnostic[] = [];
  for (const stylesheet of stylesheets) {
    const resolved = resolveStylesheet(stylesheet);
    if (!resolved || resolved.href.trim().length === 0) {
      diagnostics.push(unresolvedStylesheetDiagnostic(stylesheet));
      continue;
    }
    links.push({
      href: resolved.href,
      type: resolved.type ?? stylesheet.type,
      media: resolved.media ?? stylesheet.media,
      title: resolved.title ?? stylesheet.title,
    });
  }
  return { links, diagnostics };
}

export function stylesheetLinkElement(stylesheet: QtiResolvedStylesheet): HTMLLinkElement {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = stylesheet.href;
  if (stylesheet.type) link.type = stylesheet.type;
  if (stylesheet.media) link.media = stylesheet.media;
  if (stylesheet.title) link.title = stylesheet.title;
  return link;
}

function unresolvedStylesheetDiagnostic(stylesheet: QtiStylesheet): QtiDiagnostic {
  return {
    code: "player.stylesheet.unresolved",
    severity: "warning",
    message: `qti-stylesheet href ${JSON.stringify(stylesheet.href)} was not resolved by the host.`,
    path: stylesheet.source?.path,
    source: stylesheet.source,
  };
}
