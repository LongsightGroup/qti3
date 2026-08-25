import { escapeXmlAttribute } from "./xml.js";

export interface Qti2Revision {
  readonly target: "qti21" | "qti22";
  readonly namespace: string;
  readonly schemaLocation: string;
  readonly attributePolicy: "qti21-equivalent" | "qti22-preserve";
}

/** Lossy QTI 2.x dialect adapter for serialized QTI 3 response-processing XML. */
export function mapTypedProcessingXml(xml: string, revision: Qti2Revision): string {
  return xml
    .replaceAll(/<\/?qti-([a-z0-9-]+)/g, (tag) =>
      tag.replace("qti-", "").replace(/-([a-z])/g, (_match, value: string) => value.toUpperCase()),
    )
    .replaceAll(/ ([a-z]+)-([a-z-]+)=/g, (_match, first: string, rest: string) => {
      const camel = rest.replace(/-([a-z])/g, (_inner, value: string) => value.toUpperCase());
      return ` ${first}${camel.charAt(0).toUpperCase()}${camel.slice(1)}=`;
    })
    .replaceAll(
      /template="([^"]+)"/g,
      (_match, uri: string) => `template="${escapeXmlAttribute(targetTemplateUri(uri, revision))}"`,
    );
}

function targetTemplateUri(uri: string, revision: Qti2Revision): string {
  const name = uri
    .split("/")
    .at(-1)
    ?.replace(/\.xml$/, "");
  return name === "match_correct" || name === "map_response" || name === "map_response_point"
    ? `http://www.imsglobal.org/question/qti_${revision.target === "qti22" ? "v2p2" : "v2p1"}/rptemplates/${name}`
    : uri;
}
