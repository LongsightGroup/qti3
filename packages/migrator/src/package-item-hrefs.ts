import type { MigratableManifest, MigratableManifestResource, MigrationEntry } from "./source.js";
import type { QtiMigrationSourceFormat } from "./types.js";
import { attr, findAllDescendantsByLocalName, localName, parseXml } from "./xml.js";

function migrationEntryForHref(
  entriesByPath: ReadonlyMap<string, MigrationEntry>,
  href: string,
): MigrationEntry | undefined {
  return entriesByPath.get(href) ?? entriesByPath.get(href.replace(/^\.\//, ""));
}

export function selectPackageItemHrefs(
  sourceFormat: QtiMigrationSourceFormat,
  manifest: MigratableManifest,
  entriesByPath: ReadonlyMap<string, MigrationEntry>,
): readonly string[] {
  if (sourceFormat === "qti12") return qti12ItemHrefs(manifest, entriesByPath);
  return resourceHrefs(manifest.resources, "item");
}

function qti12ItemHrefs(
  manifest: MigratableManifest,
  entriesByPath: ReadonlyMap<string, MigrationEntry>,
): readonly string[] {
  const resourcesByIdentifier = new Map(
    manifest.resources.map((resource) => [resource.identifier, resource]),
  );
  const selected: string[] = [];
  const selectedSet = new Set<string>();
  const embedded: string[] = [];
  let hasItemRefs = false;

  for (const resource of manifest.resources) {
    if (!resource.href || resource.kind !== "qti12-container") continue;
    const entry = migrationEntryForHref(entriesByPath, resource.href);
    if (!entry?.text) continue;
    const root = parseXml(entry.text, resource.href).documentElement;
    const itemRefs = findAllDescendantsByLocalName(root, "itemref");
    if (localName(root) !== "questestinterop") continue;
    if (findAllDescendantsByLocalName(root, "item").length > 0) embedded.push(resource.href);
    hasItemRefs ||= itemRefs.length > 0;

    for (const itemRef of itemRefs) {
      const linkRefIdentifier = attr(itemRef, "linkrefid") ?? undefined;
      const href = resolveQti12ItemHref(linkRefIdentifier, resourcesByIdentifier, entriesByPath);
      if (href && !selectedSet.has(href)) {
        selectedSet.add(href);
        selected.push(href);
      }
    }
  }

  if (hasItemRefs) return selected;
  return unique([...embedded, ...resourceHrefs(manifest.resources, "item")]);
}

function resolveQti12ItemHref(
  linkRefIdentifier: string | undefined,
  resourcesByIdentifier: ReadonlyMap<string, MigratableManifestResource>,
  entriesByPath: ReadonlyMap<string, MigrationEntry>,
): string | undefined {
  if (!linkRefIdentifier) return undefined;
  const resource = resourcesByIdentifier.get(linkRefIdentifier);
  if (!resource?.href || (resource.kind !== "item" && resource.kind !== "qti12-container")) {
    return undefined;
  }
  return containsItemXml(entriesByPath, resource.href) ? resource.href : undefined;
}

function containsItemXml(
  entriesByPath: ReadonlyMap<string, MigrationEntry>,
  href: string,
): boolean {
  const entry = migrationEntryForHref(entriesByPath, href);
  if (!entry?.text) return true;
  const root = parseXml(entry.text, href).documentElement;
  return localName(root) === "item" || findAllDescendantsByLocalName(root, "item").length > 0;
}

function resourceHrefs(
  resources: readonly MigratableManifestResource[],
  kind: MigratableManifestResource["kind"],
): readonly string[] {
  return resources.flatMap((resource) =>
    resource.kind === kind && resource.href ? [resource.href] : [],
  );
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
