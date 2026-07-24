import type { QtiTranscodeFile } from "./types.js";
import { relativePackagePath } from "./package-manifest.js";
import { escapeXml } from "./xml.js";

export interface CanvasClassicPackageFiles {
  readonly assessment: QtiTranscodeFile;
  readonly metadata: QtiTranscodeFile;
  readonly manifest: string;
}

export function serializeCanvasClassicPackage(
  identifier: string,
  title: string,
  items: readonly QtiTranscodeFile[],
  assets: readonly QtiTranscodeFile[],
  assetOwners: ReadonlyMap<string, readonly string[]>,
): CanvasClassicPackageFiles {
  const assessmentPath = "assessment_qti.xml";
  const metadataPath = "assessment_meta.xml";
  const itemXml = items
    .map((item) => {
      if (typeof item.data !== "string") {
        throw new Error(`Canvas assessment item ${item.path} is not XML text.`);
      }
      const fragment = extractQti12Item(item.data);
      return rewriteCanvasAssetReferences(fragment, item.path, assets, assetOwners);
    })
    .join("\n      ");
  const safeIdentifier = identifier.replace(/[^A-Za-z0-9_.-]/g, "_") || "ASSESSMENT";
  const assessment: QtiTranscodeFile = {
    path: assessmentPath,
    data: `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="${escapeXml(safeIdentifier)}" title="${escapeXml(title)}">
    <qtimetadata>
      <qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
      ${itemXml}
    </section>
  </assessment>
</questestinterop>`,
  };
  const points = items.reduce((total, item) => {
    if (typeof item.data !== "string") return total;
    const match = item.data.match(
      /<fieldlabel>points_possible<\/fieldlabel><fieldentry>([^<]+)<\/fieldentry>/,
    );
    const value = Number(match?.[1]);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
  const metadata: QtiTranscodeFile = {
    path: metadataPath,
    data: canvasAssessmentMetadata(safeIdentifier, title, points),
  };
  const assetResources = assets
    .map(
      (asset, index) =>
        `    <resource identifier="WEB_CONTENT_${String(index + 1)}" type="webcontent" href="${escapeXml(
          asset.path,
        )}"><file href="${escapeXml(asset.path)}"/></resource>`,
    )
    .join("\n");
  return {
    assessment,
    metadata,
    manifest: `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST_${escapeXml(
      safeIdentifier,
    )}" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"
  xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
  xmlns:lom="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lomresource_v1p0.xsd http://www.imsglobal.org/xsd/imsmd_v1p2 http://www.imsglobal.org/xsd/imsmd_v1p2p2.xsd">
  <metadata><schema>IMS Content</schema><schemaversion>1.1.3</schemaversion></metadata>
  <organizations/>
  <resources>
    <resource identifier="ASSESSMENT" type="imsqti_xmlv1p2" href="${assessmentPath}">
      <file href="${assessmentPath}"/>
      <dependency identifierref="ASSESSMENT_META"/>
    </resource>
    <resource identifier="ASSESSMENT_META" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="${metadataPath}">
      <file href="${metadataPath}"/>
    </resource>
${assetResources}
  </resources>
</manifest>`,
  };
}

function extractQti12Item(xml: string): string {
  const start = xml.indexOf("<item ");
  const end = xml.lastIndexOf("</item>");
  if (start < 0 || end < start) {
    throw new Error("Generated Canvas QTI 1.2 item lacks an item element.");
  }
  return xml.slice(start, end + "</item>".length);
}

function rewriteCanvasAssetReferences(
  xml: string,
  itemPath: string,
  assets: readonly QtiTranscodeFile[],
  assetOwners: ReadonlyMap<string, readonly string[]>,
): string {
  let rewritten = xml;
  for (const asset of assets) {
    if (!assetOwners.get(asset.path)?.includes(itemPath)) continue;
    const relative = relativePackagePath(itemPath, asset.path);
    rewritten = rewritten
      .replaceAll(relative, asset.path)
      .replaceAll(`$IMS_CC_FILE_BASE$${relative}`, `$IMS_CC_FILE_BASE$${asset.path}`)
      .replaceAll(`$IMS-CC-FILEBASE$/${relative}`, `$IMS-CC-FILEBASE$/${asset.path}`);
  }
  return rewritten;
}

function canvasAssessmentMetadata(identifier: string, title: string, points: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz identifier="${escapeXml(identifier)}" xmlns="http://canvas.instructure.com/xsd/cccv1p0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">
  <title>${escapeXml(title)}</title>
  <description></description>
  <shuffle_answers>false</shuffle_answers>
  <scoring_policy>keep_highest</scoring_policy>
  <hide_results></hide_results>
  <quiz_type>assignment</quiz_type>
  <points_possible>${String(points)}</points_possible>
  <allowed_attempts>1</allowed_attempts>
  <one_question_at_a_time>false</one_question_at_a_time>
  <cant_go_back>false</cant_go_back>
  <available>true</available>
  <one_time_results>false</one_time_results>
  <show_correct_answers>true</show_correct_answers>
  <only_visible_to_overrides>false</only_visible_to_overrides>
  <module_locked>false</module_locked>
</quiz>`;
}
