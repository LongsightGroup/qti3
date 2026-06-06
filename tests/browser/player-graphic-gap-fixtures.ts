export function graySvgDataUrl(width: number, height: number): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#777"/></svg>`,
  )}`;
}

export function svgBase64DataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export const GRAPHIC_GAP_SELECTION_THEMES_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-gap-selection-themes" title="graphic-gap-selection-themes" time-dependent="false">
  <qti-response-declaration identifier="LIGHT_RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-response-declaration identifier="DARK_RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction class="qti-selections-light" response-identifier="LIGHT_RESPONSE">
      <object data="${graySvgDataUrl(220, 120)}" alt="Light theme target." type="image/svg+xml" width="220" height="120"/>
      <qti-gap-text identifier="LA" match-max="1">Light token</qti-gap-text>
      <qti-associable-hotspot identifier="LT" shape="rect" coords="40,30,100,80" match-max="1"/>
    </qti-graphic-gap-match-interaction>
    <qti-graphic-gap-match-interaction class="qti-selections-dark" response-identifier="DARK_RESPONSE">
      <object data="${graySvgDataUrl(220, 120)}" alt="Dark theme target." type="image/svg+xml" width="220" height="120"/>
      <qti-gap-text identifier="DA" match-max="1">Dark token</qti-gap-text>
      <qti-associable-hotspot identifier="DT" shape="rect" coords="40,30,100,80" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`;

export const GRAPHIC_GAP_UNSELECTED_HIDDEN_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-gap-unselected-hidden" title="graphic-gap-unselected-hidden" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction class="qti-selections-dark qti-unselected-hidden" response-identifier="RESPONSE">
      <object data="${graySvgDataUrl(240, 140)}" alt="Graphic gap shared vocabulary target." type="image/svg+xml" width="240" height="140"/>
      <qti-gap-text identifier="A" match-max="1">Alpha</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">Beta</qti-gap-text>
      <qti-associable-hotspot identifier="T1" shape="rect" coords="24,24,84,76" match-max="1"/>
      <qti-associable-hotspot identifier="T2" shape="rect" coords="132,24,192,76" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`;

const FITTING_TIMELINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="140" viewBox="0 0 220 140"><rect width="220" height="140" fill="#f4f2ea"/><rect x="54" y="34" width="100" height="70" fill="#2f4858"/></svg>`;
const FITTING_CHOICE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="56" viewBox="0 0 80 56"><rect width="80" height="56" rx="4" fill="#fff"/><path d="M12 37h56" stroke="#2f4858" stroke-width="6"/><text x="40" y="27" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;

export const FITTING_GAP_IMG_GRAPHIC_GAP_MATCH_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="fit-gap-img-graphic-gap-match" title="fit-gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${svgBase64DataUrl(FITTING_TIMELINE_SVG)}" alt="Timeline target." type="image/svg+xml"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="56" src="${svgBase64DataUrl(FITTING_CHOICE_SVG)}" width="80"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="A" shape="rect" coords="54,34,154,104" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`;
