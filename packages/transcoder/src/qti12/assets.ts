import type { QtiContentNode, QtiInteraction, QtiObjectAsset } from "@longsightgroup/qti3-core";

import { escapeXmlAttribute } from "../xml.js";

export function portableCustomAssets(interaction: QtiInteraction): QtiObjectAsset[] {
  if (!interaction.portableCustom) return [];
  const paths = [
    interaction.portableCustom.interactionModules?.primaryConfiguration,
    interaction.portableCustom.interactionModules?.secondaryConfiguration,
    ...(interaction.portableCustom.interactionModules?.modules.flatMap((module) => [
      module.primaryPath,
      module.fallbackPath,
    ]) ?? []),
    ...interaction.portableCustom.stylesheets.map((stylesheet) => stylesheet.href),
  ].filter((path): path is string => Boolean(path));
  return paths.map((path) => ({
    data: path,
    type: path.endsWith(".css")
      ? "text/css"
      : path.endsWith(".js")
        ? "application/javascript"
        : "application/octet-stream",
    text: "Custom interaction dependency",
    attributes: {},
    sources: [],
    tracks: [],
  }));
}

export function serializeQti12ContentAssets(nodes: readonly QtiContentNode[]): string {
  return nodes
    .flatMap((node): string[] => {
      if (node.kind === "feedback" || node.kind === "element") {
        const nested = serializeQti12ContentAssets(node.children);
        if (node.kind === "feedback") return nested ? [nested] : [];
        const href = node.attributes.src ?? node.attributes.data;
        if (!href) return nested ? [nested] : [];
        const type =
          node.attributes.type ??
          (node.qtiName === "img" ? inferImageType(href) : "application/octet-stream");
        const asset: QtiObjectAsset = {
          data: href,
          type,
          text: node.attributes.alt ?? node.attributes.label ?? "Question media",
          attributes: {},
          sources: [],
          tracks: [],
        };
        return [serializeQti12Asset(asset), ...(nested ? [nested] : [])];
      }
      return [];
    })
    .join("");
}

function inferImageType(path: string): string {
  const extension = path.split(/[?#]/, 1)[0]?.split(".").at(-1)?.toLowerCase();
  return extension === "png"
    ? "image/png"
    : extension === "gif"
      ? "image/gif"
      : extension === "svg"
        ? "image/svg+xml"
        : "image/jpeg";
}

export function serializeQti12Asset(asset: QtiObjectAsset): string {
  const candidates = [
    ...(asset.data ? [{ src: asset.data, type: asset.type }] : []),
    ...asset.sources,
  ];
  return candidates
    .filter((candidate) => candidate.src)
    .map((candidate) => {
      const src = escapeXmlAttribute(candidate.src ?? "");
      const type = candidate.type ?? asset.type ?? "application/octet-stream";
      const label = escapeXmlAttribute(asset.text || "Question media");
      if (type.startsWith("image/")) {
        return `<material><matimage uri="${src}" imagtype="${escapeXmlAttribute(type)}" label="${label}"${
          asset.width ? ` width="${escapeXmlAttribute(asset.width)}"` : ""
        }${asset.height ? ` height="${escapeXmlAttribute(asset.height)}"` : ""}></matimage></material>`;
      }
      if (type.startsWith("audio/")) {
        return `<material><mataudio uri="${src}" audiotype="${escapeXmlAttribute(type)}" label="${label}"></mataudio></material>`;
      }
      if (type.startsWith("video/")) {
        return `<material><matvideo uri="${src}" videotype="${escapeXmlAttribute(type)}" label="${label}"${
          asset.width ? ` width="${escapeXmlAttribute(asset.width)}"` : ""
        }${asset.height ? ` height="${escapeXmlAttribute(asset.height)}"` : ""}></matvideo></material>`;
      }
      return `<material><matapplication uri="${src}" apptype="${escapeXmlAttribute(type)}" label="${label}"></matapplication></material>`;
    })
    .join("");
}
