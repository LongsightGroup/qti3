type SliderItemOptions = {
  readonly attributes: string;
  readonly baseType?: "integer" | "float";
  readonly identifier: string;
  readonly prompt?: string;
};

/** Builds a minimal synthetic QTI slider item for browser behavior tests. */
export function sliderItem({
  attributes,
  baseType = "integer",
  identifier,
  prompt = "Choose a value.",
}: SliderItemOptions): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="${baseType}"/>
  <qti-item-body>
    <qti-slider-interaction response-identifier="RESPONSE" ${attributes}>
      <qti-prompt>${prompt}</qti-prompt>
    </qti-slider-interaction>
  </qti-item-body>
</qti-assessment-item>`;
}
