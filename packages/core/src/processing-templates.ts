export type ResponseProcessingTemplateKind = "matchCorrect" | "mapResponse" | "mapResponsePoint";

export function responseProcessingTemplateKind(
  template: string,
): ResponseProcessingTemplateKind | undefined {
  const path = template.split(/[?#]/, 1)[0] ?? "";
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.xml$/i, "");
  if (name === "match_correct") return "matchCorrect";
  if (name === "map_response") return "mapResponse";
  if (name === "map_response_point") return "mapResponsePoint";
  return undefined;
}
