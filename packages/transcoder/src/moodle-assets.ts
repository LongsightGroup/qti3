import type { QtiInteraction } from "@longsightgroup/qti3-core";

import { escapeXml } from "./xml.js";

/** Project retained interaction assets into HTML links and media elements for Moodle. */
export function serializeMoodleInteractionAssets(interactions: readonly QtiInteraction[]): string {
  const assets = interactions.flatMap((interaction) => [
    interaction.object,
    interaction.positionObjectStage,
    ...interaction.choices.map((choice) => choice.asset),
  ]);
  const renderedAssets = assets
    .filter((asset): asset is NonNullable<typeof asset> => asset !== undefined)
    .flatMap((asset) => [
      ...(asset.data ? [{ href: asset.data, type: asset.type, label: asset.text }] : []),
      ...asset.sources.flatMap((source) =>
        source.src
          ? [{ href: source.src, type: source.type ?? asset.type, label: asset.text }]
          : [],
      ),
      ...asset.tracks.flatMap((track) =>
        track.src
          ? [{ href: track.src, type: "text/vtt", label: track.label ?? "Media captions" }]
          : [],
      ),
    ])
    .map((asset) =>
      asset.type?.startsWith("image/")
        ? `<p><img src="${escapeXml(asset.href)}" alt="${escapeXml(
            asset.label || "Question media",
          )}"></p>`
        : `<p><a href="${escapeXml(asset.href)}">${escapeXml(
            asset.label || "Question media",
          )}</a></p>`,
    );
  const portableDependencies = interactions.flatMap((interaction) => {
    const portable = interaction.portableCustom;
    if (!portable) return [];
    return [
      portable.interactionModules?.primaryConfiguration,
      portable.interactionModules?.secondaryConfiguration,
      ...(portable.interactionModules?.modules.flatMap((module) => [
        module.primaryPath,
        module.fallbackPath,
      ]) ?? []),
      ...portable.stylesheets.map((stylesheet) => stylesheet.href),
    ]
      .filter((href): href is string => Boolean(href))
      .map(
        (href) =>
          `<p><a href="${escapeXml(href)}">Custom interaction dependency: ${escapeXml(
            href,
          )}</a></p>`,
      );
  });
  return [...renderedAssets, ...portableDependencies].join("");
}
