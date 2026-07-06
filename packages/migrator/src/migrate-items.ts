import { migrationPathIdentifier } from "./identifiers.js";
import type { PendingMigrationItem } from "./item-finalize.js";
import { migrateQti12Xml } from "./qti12-item.js";
import { itemTitleFromXml, migrateQti2ItemXml } from "./qti2-item.js";
import type { QtiMigrationSourceFormat } from "./types.js";
import type { ResolvedQtiMigrationOptions } from "./types.js";

export function migrateItemXml(
  xml: string,
  path: string,
  sourceFormat: QtiMigrationSourceFormat,
  options: ResolvedQtiMigrationOptions,
): readonly PendingMigrationItem[] {
  if (sourceFormat === "qti12") {
    return migrateQti12Xml(xml, path, options).map((result, index) => ({
      identifier: result.authoringItem?.identifier ?? `ITEM_${index + 1}`,
      title: result.authoringItem?.title ?? itemTitleFromXmlSafe(xml),
      authoringItem: result.authoringItem,
      diagnostics: result.diagnostics,
    }));
  }
  const result = migrateQti2ItemXml(xml, path, sourceFormat, options);
  return [
    {
      identifier: result.authoringItem?.identifier ?? migrationPathIdentifier(path),
      title: result.authoringItem?.title ?? itemTitleFromXmlSafe(xml),
      authoringItem: result.authoringItem,
      diagnostics: result.diagnostics,
    },
  ];
}

export function itemTitleFromXmlSafe(xml: string): string {
  try {
    return itemTitleFromXml(xml);
  } catch {
    return "Imported Item";
  }
}
