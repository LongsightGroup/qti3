import type { QtiPlayerMessages } from "./player-messages.js";
import type { QtiPlayerMovementDirection } from "./player-messages.js";

type ChromeCatalog = Pick<
  QtiPlayerMessages,
  | "interactionType"
  | "matchSourcesBank"
  | "matchTargetsBank"
  | "matchSelectedPairsList"
  | "interactionSourcesBank"
  | "interactionTargetsBank"
  | "interactionSelectedPairsList"
  | "associateFirstConceptRegion"
  | "associatePairWithRegion"
  | "matchPromptRegion"
  | "matchMatchRegion"
  | "genericSourceRegion"
  | "genericTargetRegion"
  | "interactionHotspots"
  | "interactionImageAlt"
  | "interactionCurrentOrderList"
  | "interactionSelectedOrderList"
  | "interactionChoicesBank"
  | "interactionGapTargets"
  | "interactionTargetImage"
  | "interactionOptionsList"
  | "interactionCoordinateResponse"
  | "interactionCoordinateArea"
  | "interactionCoordinateAreaSelected"
  | "interactionPlacementResponse"
  | "interactionPlacementStage"
  | "interactionPlacementStageEmpty"
  | "interactionPlacementStageAt"
  | "interactionDrawingResponse"
  | "drawingSurface"
  | "drawingSurfaceEmpty"
  | "drawingSurfaceStrokeCount"
  | "drawingStatusEmpty"
  | "drawingStatusStrokeCount"
  | "gapLabel"
  | "graphicGapTargetLabel"
  | "gapEmptyState"
  | "gapAssignedState"
  | "gapLabelsPlacedCount"
  | "gapNoLabelsPlaced"
  | "orderedItemAtPosition"
  | "orderedItemMovedOneStep"
  | "orderedItemMovedToPosition"
  | "graphicOrderRegionsSelected"
  | "graphicOrderNoRegionsSelected"
  | "objectNotPlaced"
  | "objectPositionedAt"
  | "selectedPointAt"
  | "selectedPointsSummary"
  | "extendedTextResponseLabel"
  | "textResponseLabel"
  | "sliderResponseLabel"
>;

function readableTypeFallback(type: string): string {
  return type
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/^./, (letter) => letter.toUpperCase());
}

const englishInteractionTypes: Record<string, string> = {
  associate: "Associate",
  choice: "Choice",
  drawing: "Drawing",
  endAttempt: "End attempt",
  extendedText: "Extended text",
  gapMatch: "Gap match",
  graphicAssociate: "Graphic associate",
  graphicGapMatch: "Graphic gap match",
  graphicOrder: "Graphic order",
  hottext: "Hot text",
  hotspot: "Hotspot",
  inlineChoice: "Inline choice",
  match: "Match",
  media: "Media",
  order: "Order",
  pair: "Pair",
  portableCustom: "Portable custom",
  positionObject: "Position object",
  selectPoint: "Select point",
  slider: "Slider",
  textEntry: "Text entry",
  upload: "Upload",
};

const spanishInteractionTypes: Record<string, string> = {
  ...englishInteractionTypes,
  associate: "Asociar",
  choice: "Eleccion",
  drawing: "Dibujo",
  extendedText: "Texto extendido",
  gapMatch: "Emparejar huecos",
  graphicAssociate: "Asociar grafico",
  graphicGapMatch: "Hueco grafico",
  graphicOrder: "Orden grafico",
  match: "Emparejar",
  order: "Ordenar",
  positionObject: "Posicionar objeto",
  selectPoint: "Seleccionar punto",
  textEntry: "Entrada de texto",
};

const swedishInteractionTypes: Record<string, string> = {
  associate: "Association",
  choice: "Enval",
  drawing: "Ritning",
  endAttempt: "Avsluta forsok",
  extendedText: "Utokad text",
  gapMatch: "Luckmatchning",
  graphicAssociate: "Grafisk association",
  graphicGapMatch: "Grafisk luckmatchning",
  graphicOrder: "Grafisk ordning",
  hottext: "Markeringstext",
  hotspot: "Hotspot",
  inlineChoice: "Inlineval",
  match: "Matchning",
  media: "Media",
  order: "Ordning",
  pair: "Par",
  portableCustom: "Portabel anpassad",
  positionObject: "Objektplacering",
  selectPoint: "Punktval",
  slider: "Skjutreglage",
  textEntry: "Textinmatning",
  upload: "Uppladdning",
};

const germanInteractionTypes: Record<string, string> = {
  ...englishInteractionTypes,
  associate: "Zuordnen",
  choice: "Auswahl",
  drawing: "Zeichnung",
  extendedText: "Erweiterter Text",
  gapMatch: "Luckenzuordnung",
  graphicAssociate: "Grafische Zuordnung",
  graphicGapMatch: "Grafische Lucken",
  graphicOrder: "Grafische Reihenfolge",
  match: "Zuordnung",
  order: "Reihenfolge",
  positionObject: "Objekt platzieren",
  selectPoint: "Punkt wahlen",
  textEntry: "Texteingabe",
};

const portugueseInteractionTypes: Record<string, string> = {
  ...englishInteractionTypes,
  associate: "Associar",
  choice: "Escolha",
  drawing: "Desenho",
  extendedText: "Texto estendido",
  gapMatch: "Correspondencia de lacunas",
  graphicAssociate: "Associacao grafica",
  graphicGapMatch: "Lacuna grafica",
  graphicOrder: "Ordem grafica",
  match: "Correspondencia",
  order: "Ordenar",
  positionObject: "Posicionar objeto",
  selectPoint: "Selecionar ponto",
  textEntry: "Entrada de texto",
};

const frenchInteractionTypes: Record<string, string> = {
  ...englishInteractionTypes,
  associate: "Associer",
  choice: "Choix",
  drawing: "Dessin",
  extendedText: "Texte etendu",
  gapMatch: "Correspondance de lacunes",
  graphicAssociate: "Association graphique",
  graphicGapMatch: "Lacune graphique",
  graphicOrder: "Ordre graphique",
  match: "Correspondance",
  order: "Ordre",
  positionObject: "Positionner l'objet",
  selectPoint: "Selectionner un point",
  textEntry: "Saisie de texte",
};

function interactionTypeName(
  types: Record<string, string>,
  type: string,
): string {
  return types[type] ?? readableTypeFallback(type);
}

function englishDirection(direction: QtiPlayerMovementDirection): string {
  return { up: "up", down: "down", left: "left", right: "right" }[direction];
}

function buildChromeCatalog(
  types: Record<string, string>,
  strings: {
    matchSources: string;
    matchTargets: string;
    matchPairs: string;
    sourcesBank: (name: string) => string;
    targetsBank: (name: string) => string;
    selectedPairs: (name: string) => string;
    associateFirst: string;
    associatePairWith: string;
    matchPrompt: string;
    matchMatch: string;
    genericSource: string;
    genericTarget: string;
    hotspots: (name: string) => string;
    imageAlt: (name: string) => string;
    currentOrder: (name: string) => string;
    selectedOrder: (name: string) => string;
    choicesBank: (name: string) => string;
    gapTargets: (name: string) => string;
    targetImage: (name: string) => string;
    options: (name: string) => string;
    coordinateResponse: (name: string) => string;
    coordinateArea: (name: string) => string;
    coordinateAreaSelected: (name: string, coords: string) => string;
    placementResponse: (name: string) => string;
    placementStage: (name: string) => string;
    placementStageEmpty: (name: string) => string;
    placementStageAt: (name: string, coords: string) => string;
    drawingResponse: (name: string) => string;
    drawingSurfaceLabel: string;
    drawingSurfaceEmpty: string;
    drawingSurfaceStrokes: (count: number) => string;
    drawingStatusEmpty: string;
    drawingStatusStrokes: (count: number) => string;
    gapLabel: (index: number) => string;
    graphicGapTarget: (index: number) => string;
    gapEmpty: (label: string) => string;
    gapAssigned: (label: string, assigned: string) => string;
    gapPlaced: (count: number) => string;
    gapNonePlaced: string;
    orderedAt: (label: string, position: number, total: number) => string;
    movedStep: (label: string, direction: "up" | "down") => string;
    movedTo: (label: string, position: number, total: number) => string;
    regionsSelected: (count: number) => string;
    noRegionsSelected: string;
    objectNotPlaced: string;
    objectAt: (coords: string) => string;
    pointAt: (coords: string) => string;
    pointsSummary: (count: number, coords: string) => string;
    extendedText: string;
    textResponse: string;
    sliderResponse: string;
  },
): ChromeCatalog {
  const typeName = (type: string) => interactionTypeName(types, type);
  return {
    interactionType: ({ type }) => typeName(type),
    matchSourcesBank: () => strings.matchSources,
    matchTargetsBank: () => strings.matchTargets,
    matchSelectedPairsList: () => strings.matchPairs,
    interactionSourcesBank: ({ type }) => strings.sourcesBank(typeName(type)),
    interactionTargetsBank: ({ type }) => strings.targetsBank(typeName(type)),
    interactionSelectedPairsList: ({ type }) => strings.selectedPairs(typeName(type)),
    associateFirstConceptRegion: () => strings.associateFirst,
    associatePairWithRegion: () => strings.associatePairWith,
    matchPromptRegion: () => strings.matchPrompt,
    matchMatchRegion: () => strings.matchMatch,
    genericSourceRegion: () => strings.genericSource,
    genericTargetRegion: () => strings.genericTarget,
    interactionHotspots: ({ type }) => strings.hotspots(typeName(type)),
    interactionImageAlt: ({ type }) => strings.imageAlt(typeName(type)),
    interactionCurrentOrderList: ({ type }) => strings.currentOrder(typeName(type)),
    interactionSelectedOrderList: ({ type }) => strings.selectedOrder(typeName(type)),
    interactionChoicesBank: ({ type }) => strings.choicesBank(typeName(type)),
    interactionGapTargets: ({ type }) => strings.gapTargets(typeName(type)),
    interactionTargetImage: ({ type }) => strings.targetImage(typeName(type)),
    interactionOptionsList: ({ type }) => strings.options(typeName(type)),
    interactionCoordinateResponse: ({ type }) => strings.coordinateResponse(typeName(type)),
    interactionCoordinateArea: ({ type }) => strings.coordinateArea(typeName(type)),
    interactionCoordinateAreaSelected: ({ type, coordinates }) =>
      strings.coordinateAreaSelected(typeName(type), coordinates),
    interactionPlacementResponse: ({ type }) => strings.placementResponse(typeName(type)),
    interactionPlacementStage: ({ type }) => strings.placementStage(typeName(type)),
    interactionPlacementStageEmpty: ({ type }) => strings.placementStageEmpty(typeName(type)),
    interactionPlacementStageAt: ({ type, coordinates }) =>
      strings.placementStageAt(typeName(type), coordinates),
    interactionDrawingResponse: ({ type }) => strings.drawingResponse(typeName(type)),
    drawingSurface: () => strings.drawingSurfaceLabel,
    drawingSurfaceEmpty: () => strings.drawingSurfaceEmpty,
    drawingSurfaceStrokeCount: ({ count }) => strings.drawingSurfaceStrokes(count),
    drawingStatusEmpty: () => strings.drawingStatusEmpty,
    drawingStatusStrokeCount: ({ count }) => strings.drawingStatusStrokes(count),
    gapLabel: ({ index }) => strings.gapLabel(index),
    graphicGapTargetLabel: ({ index }) => strings.graphicGapTarget(index),
    gapEmptyState: ({ label }) => strings.gapEmpty(label),
    gapAssignedState: ({ label, assigned }) => strings.gapAssigned(label, assigned),
    gapLabelsPlacedCount: ({ count }) => strings.gapPlaced(count),
    gapNoLabelsPlaced: () => strings.gapNonePlaced,
    orderedItemAtPosition: ({ label, position, total }) =>
      strings.orderedAt(label, position, total),
    orderedItemMovedOneStep: ({ label, direction }) => strings.movedStep(label, direction),
    orderedItemMovedToPosition: ({ label, position, total }) =>
      strings.movedTo(label, position, total),
    graphicOrderRegionsSelected: ({ count }) => strings.regionsSelected(count),
    graphicOrderNoRegionsSelected: () => strings.noRegionsSelected,
    objectNotPlaced: () => strings.objectNotPlaced,
    objectPositionedAt: ({ coordinates }) => strings.objectAt(coordinates),
    selectedPointAt: ({ coordinates }) => strings.pointAt(coordinates),
    selectedPointsSummary: ({ count, coordinates }) => strings.pointsSummary(count, coordinates),
    extendedTextResponseLabel: () => strings.extendedText,
    textResponseLabel: () => strings.textResponse,
    sliderResponseLabel: () => strings.sliderResponse,
  };
}

export const englishChromeMessages = buildChromeCatalog(englishInteractionTypes, {
  matchSources: "Match sources",
  matchTargets: "Match targets",
  matchPairs: "Match selected pairs",
  sourcesBank: (name) => `${name} sources`,
  targetsBank: (name) => `${name} targets`,
  selectedPairs: (name) => `${name} selected pairs`,
  associateFirst: "First concept",
  associatePairWith: "Pair with",
  matchPrompt: "Prompt",
  matchMatch: "Match",
  genericSource: "Source",
  genericTarget: "Target",
  hotspots: (name) => `${name} hotspots`,
  imageAlt: (name) => `${name} image`,
  currentOrder: (name) => `${name} current order`,
  selectedOrder: (name) => `${name} selected order`,
  choicesBank: (name) => `${name} choices`,
  gapTargets: (name) => `${name} targets`,
  targetImage: (name) => `${name} target image`,
  options: (name) => `${name} options`,
  coordinateResponse: (name) => `${name} coordinate response`,
  coordinateArea: (name) => `${name} coordinate area`,
  coordinateAreaSelected: (name, coords) => `${name} coordinate area, selected ${coords}`,
  placementResponse: (name) => `${name} object placement response`,
  placementStage: (name) => `${name} placement stage`,
  placementStageEmpty: (name) => `${name} placement stage, object not placed`,
  placementStageAt: (name, coords) => `${name} placement stage, object at ${coords}`,
  drawingResponse: (name) => `${name} response`,
  drawingSurfaceLabel: "Drawing response surface",
  drawingSurfaceEmpty: "Drawing response surface, no strokes",
  drawingSurfaceStrokes: (count) =>
    `Drawing response surface, ${count} stroke${count === 1 ? "" : "s"}`,
  drawingStatusEmpty: "No drawing strokes.",
  drawingStatusStrokes: (count) => `${count} drawing stroke${count === 1 ? "" : "s"}.`,
  gapLabel: (index) => `Gap ${index}`,
  graphicGapTarget: (index) => `Target ${index}`,
  gapEmpty: (label) => `${label}, empty`,
  gapAssigned: (label, assigned) => `${label}, assigned ${assigned}`,
  gapPlaced: (count) => `${count} ${count === 1 ? "label" : "labels"} placed.`,
  gapNonePlaced: "No labels placed.",
  orderedAt: (label, position, total) => `${label}, position ${position} of ${total}`,
  movedStep: (label, direction) => `${label} moved ${direction}.`,
  movedTo: (label, position, total) => `${label} moved to position ${position} of ${total}.`,
  regionsSelected: (count) => `${count} ${count === 1 ? "region ordered" : "regions ordered"}.`,
  noRegionsSelected: "No regions ordered.",
  objectNotPlaced: "Object not placed",
  objectAt: (coords) => `Object positioned at ${coords}`,
  pointAt: (coords) => `Selected point ${coords}`,
  pointsSummary: (count, coords) =>
    `${count} selected point${count === 1 ? "" : "s"}: ${coords}`,
  extendedText: "Extended text response",
  textResponse: "Text response",
  sliderResponse: "Slider response",
});

export const spanishChromeMessages = buildChromeCatalog(spanishInteractionTypes, {
  matchSources: "Fuentes de emparejamiento",
  matchTargets: "Destinos de emparejamiento",
  matchPairs: "Pares seleccionados",
  sourcesBank: (name) => `Fuentes de ${name}`,
  targetsBank: (name) => `Destinos de ${name}`,
  selectedPairs: (name) => `Pares seleccionados de ${name}`,
  associateFirst: "Primer concepto",
  associatePairWith: "Emparejar con",
  matchPrompt: "Indicacion",
  matchMatch: "Emparejar",
  genericSource: "Origen",
  genericTarget: "Destino",
  hotspots: (name) => `Puntos activos de ${name}`,
  imageAlt: (name) => `Imagen de ${name}`,
  currentOrder: (name) => `Orden actual de ${name}`,
  selectedOrder: (name) => `Orden seleccionada de ${name}`,
  choicesBank: (name) => `Opciones de ${name}`,
  gapTargets: (name) => `Destinos de ${name}`,
  targetImage: (name) => `Imagen destino de ${name}`,
  options: (name) => `Opciones de ${name}`,
  coordinateResponse: (name) => `Respuesta de coordenadas de ${name}`,
  coordinateArea: (name) => `Area de coordenadas de ${name}`,
  coordinateAreaSelected: (name, coords) => `Area de coordenadas de ${name}, seleccionado ${coords}`,
  placementResponse: (name) => `Respuesta de colocacion de ${name}`,
  placementStage: (name) => `Area de colocacion de ${name}`,
  placementStageEmpty: (name) => `Area de colocacion de ${name}, objeto sin colocar`,
  placementStageAt: (name, coords) => `Area de colocacion de ${name}, objeto en ${coords}`,
  drawingResponse: (name) => `Respuesta de ${name}`,
  drawingSurfaceLabel: "Superficie de dibujo",
  drawingSurfaceEmpty: "Superficie de dibujo, sin trazos",
  drawingSurfaceStrokes: (count) =>
    `Superficie de dibujo, ${count} ${count === 1 ? "trazo" : "trazos"}`,
  drawingStatusEmpty: "Sin trazos de dibujo.",
  drawingStatusStrokes: (count) => `${count} ${count === 1 ? "trazo" : "trazos"} de dibujo.`,
  gapLabel: (index) => `Hueco ${index}`,
  graphicGapTarget: (index) => `Destino ${index}`,
  gapEmpty: (label) => `${label}, vacio`,
  gapAssigned: (label, assigned) => `${label}, asignado ${assigned}`,
  gapPlaced: (count) => `${count} ${count === 1 ? "etiqueta colocada" : "etiquetas colocadas"}.`,
  gapNonePlaced: "Ninguna etiqueta colocada.",
  orderedAt: (label, position, total) => `${label}, posicion ${position} de ${total}`,
  movedStep: (label, direction) =>
    `${label} movido ${direction === "up" ? "arriba" : "abajo"}.`,
  movedTo: (label, position, total) =>
    `${label} movido a la posicion ${position} de ${total}.`,
  regionsSelected: (count) =>
    `${count} ${count === 1 ? "region ordenada" : "regiones ordenadas"}.`,
  noRegionsSelected: "Ninguna region ordenada.",
  objectNotPlaced: "Objeto sin colocar",
  objectAt: (coords) => `Objeto colocado en ${coords}`,
  pointAt: (coords) => `Punto seleccionado ${coords}`,
  pointsSummary: (count, coords) =>
    `${count} ${count === 1 ? "punto seleccionado" : "puntos seleccionados"}: ${coords}`,
  extendedText: "Respuesta de texto extendido",
  textResponse: "Respuesta de texto",
  sliderResponse: "Respuesta de control deslizante",
});

export const swedishChromeMessages = buildChromeCatalog(swedishInteractionTypes, {
  matchSources: "Matchningskallor",
  matchTargets: "Matchningsmal",
  matchPairs: "Valda matchningspar",
  sourcesBank: (name) => `${name}, kallor`,
  targetsBank: (name) => `${name}, mal`,
  selectedPairs: (name) => `${name}, valda par`,
  associateFirst: "Forsta begrepp",
  associatePairWith: "Para ihop med",
  matchPrompt: "Ledtext",
  matchMatch: "Matcha",
  genericSource: "Kalla",
  genericTarget: "Mal",
  hotspots: (name) => `${name}, hotspots`,
  imageAlt: (name) => `${name}, bild`,
  currentOrder: (name) => `${name}, nuvarande ordning`,
  selectedOrder: (name) => `${name}, vald ordning`,
  choicesBank: (name) => `${name}, val`,
  gapTargets: (name) => `${name}, mal`,
  targetImage: (name) => `${name}, malbild`,
  options: (name) => `${name}, alternativ`,
  coordinateResponse: (name) => `${name}, koordinatsvar`,
  coordinateArea: (name) => `${name}, koordinatomrade`,
  coordinateAreaSelected: (name, coords) => `${name}, koordinatomrade, valt ${coords}`,
  placementResponse: (name) => `${name}, objektplaceringssvar`,
  placementStage: (name) => `${name}, placeringsyta`,
  placementStageEmpty: (name) => `${name}, placeringsyta, objekt ej placerat`,
  placementStageAt: (name, coords) => `${name}, placeringsyta, objekt vid ${coords}`,
  drawingResponse: (name) => `${name}, svar`,
  drawingSurfaceLabel: "Ritningsyta",
  drawingSurfaceEmpty: "Ritningsyta, inga streck",
  drawingSurfaceStrokes: (count) =>
    `Ritningsyta, ${count} ${count === 1 ? "streck" : "streck"}`,
  drawingStatusEmpty: "Inga ritstreck.",
  drawingStatusStrokes: (count) => `${count} ritstreck.`,
  gapLabel: (index) => `Lucka ${index}`,
  graphicGapTarget: (index) => `Mal ${index}`,
  gapEmpty: (label) => `${label}, tom`,
  gapAssigned: (label, assigned) => `${label}, tilldelad ${assigned}`,
  gapPlaced: (count) => `${count} ${count === 1 ? "etikett placerad" : "etiketter placerade"}.`,
  gapNonePlaced: "Inga etiketter placerade.",
  orderedAt: (label, position, total) => `${label}, position ${position} av ${total}`,
  movedStep: (label, direction) =>
    `${label} flyttades ${direction === "up" ? "upp" : "ned"}.`,
  movedTo: (label, position, total) =>
    `${label} flyttades till position ${position} av ${total}.`,
  regionsSelected: (count) =>
    `${count} ${count === 1 ? "region ordnad" : "regioner ordnade"}.`,
  noRegionsSelected: "Inga regioner ordnade.",
  objectNotPlaced: "Objekt ej placerat",
  objectAt: (coords) => `Objekt placerat vid ${coords}`,
  pointAt: (coords) => `Vald punkt ${coords}`,
  pointsSummary: (count, coords) =>
    `${count} ${count === 1 ? "vald punkt" : "valda punkter"}: ${coords}`,
  extendedText: "Utokat textsvar",
  textResponse: "Textsvar",
  sliderResponse: "Skjutreglagesvar",
});

export const germanChromeMessages = buildChromeCatalog(germanInteractionTypes, {
  matchSources: "Zuordnungsquellen",
  matchTargets: "Zuordnungsziele",
  matchPairs: "Ausgewaehlte Zuordnungspaare",
  sourcesBank: (name) => `${name}-Quellen`,
  targetsBank: (name) => `${name}-Ziele`,
  selectedPairs: (name) => `${name}, ausgewaehlte Paare`,
  associateFirst: "Erstes Konzept",
  associatePairWith: "Paaren mit",
  matchPrompt: "Aufforderung",
  matchMatch: "Zuordnen",
  genericSource: "Quelle",
  genericTarget: "Ziel",
  hotspots: (name) => `${name}-Hotspots`,
  imageAlt: (name) => `${name}-Bild`,
  currentOrder: (name) => `${name}, aktuelle Reihenfolge`,
  selectedOrder: (name) => `${name}, ausgewaehlte Reihenfolge`,
  choicesBank: (name) => `${name}-Auswahlen`,
  gapTargets: (name) => `${name}-Ziele`,
  targetImage: (name) => `${name}-Zielbild`,
  options: (name) => `${name}-Optionen`,
  coordinateResponse: (name) => `${name}-Koordinatenantwort`,
  coordinateArea: (name) => `${name}-Koordinatenbereich`,
  coordinateAreaSelected: (name, coords) => `${name}-Koordinatenbereich, ausgewaehlt ${coords}`,
  placementResponse: (name) => `${name}-Objektplatzierungsantwort`,
  placementStage: (name) => `${name}-Platzierungsflaeche`,
  placementStageEmpty: (name) => `${name}-Platzierungsflaeche, Objekt nicht platziert`,
  placementStageAt: (name, coords) => `${name}-Platzierungsflaeche, Objekt bei ${coords}`,
  drawingResponse: (name) => `${name}-Antwort`,
  drawingSurfaceLabel: "Zeichenflaeche",
  drawingSurfaceEmpty: "Zeichenflaeche, keine Striche",
  drawingSurfaceStrokes: (count) =>
    `Zeichenflaeche, ${count} ${count === 1 ? "Strich" : "Striche"}`,
  drawingStatusEmpty: "Keine Zeichenstriche.",
  drawingStatusStrokes: (count) => `${count} Zeichenstriche.`,
  gapLabel: (index) => `Luecke ${index}`,
  graphicGapTarget: (index) => `Ziel ${index}`,
  gapEmpty: (label) => `${label}, leer`,
  gapAssigned: (label, assigned) => `${label}, zugewiesen ${assigned}`,
  gapPlaced: (count) => `${count} ${count === 1 ? "Beschriftung platziert" : "Beschriftungen platziert"}.`,
  gapNonePlaced: "Keine Beschriftungen platziert.",
  orderedAt: (label, position, total) => `${label}, Position ${position} von ${total}`,
  movedStep: (label, direction) =>
    `${label} ${direction === "up" ? "nach oben" : "nach unten"} verschoben.`,
  movedTo: (label, position, total) =>
    `${label} auf Position ${position} von ${total} verschoben.`,
  regionsSelected: (count) =>
    `${count} ${count === 1 ? "Region geordnet" : "Regionen geordnet"}.`,
  noRegionsSelected: "Keine Regionen geordnet.",
  objectNotPlaced: "Objekt nicht platziert",
  objectAt: (coords) => `Objekt platziert bei ${coords}`,
  pointAt: (coords) => `Ausgewaehlter Punkt ${coords}`,
  pointsSummary: (count, coords) =>
    `${count} ${count === 1 ? "ausgewaehlter Punkt" : "ausgewaehlte Punkte"}: ${coords}`,
  extendedText: "Erweiterte Textantwort",
  textResponse: "Textantwort",
  sliderResponse: "Schiebereglerantwort",
});

export const portugueseChromeMessages = buildChromeCatalog(portugueseInteractionTypes, {
  matchSources: "Origens de correspondencia",
  matchTargets: "Destinos de correspondencia",
  matchPairs: "Pares selecionados",
  sourcesBank: (name) => `Origens de ${name}`,
  targetsBank: (name) => `Destinos de ${name}`,
  selectedPairs: (name) => `Pares selecionados de ${name}`,
  associateFirst: "Primeiro conceito",
  associatePairWith: "Emparelhar com",
  matchPrompt: "Instrucao",
  matchMatch: "Corresponder",
  genericSource: "Origem",
  genericTarget: "Destino",
  hotspots: (name) => `Pontos ativos de ${name}`,
  imageAlt: (name) => `Imagem de ${name}`,
  currentOrder: (name) => `Ordem atual de ${name}`,
  selectedOrder: (name) => `Ordem selecionada de ${name}`,
  choicesBank: (name) => `Opcoes de ${name}`,
  gapTargets: (name) => `Destinos de ${name}`,
  targetImage: (name) => `Imagem destino de ${name}`,
  options: (name) => `Opcoes de ${name}`,
  coordinateResponse: (name) => `Resposta de coordenadas de ${name}`,
  coordinateArea: (name) => `Area de coordenadas de ${name}`,
  coordinateAreaSelected: (name, coords) => `Area de coordenadas de ${name}, selecionado ${coords}`,
  placementResponse: (name) => `Resposta de posicionamento de ${name}`,
  placementStage: (name) => `Area de posicionamento de ${name}`,
  placementStageEmpty: (name) => `Area de posicionamento de ${name}, objeto nao posicionado`,
  placementStageAt: (name, coords) => `Area de posicionamento de ${name}, objeto em ${coords}`,
  drawingResponse: (name) => `Resposta de ${name}`,
  drawingSurfaceLabel: "Superficie de desenho",
  drawingSurfaceEmpty: "Superficie de desenho, sem tracos",
  drawingSurfaceStrokes: (count) =>
    `Superficie de desenho, ${count} ${count === 1 ? "traco" : "tracos"}`,
  drawingStatusEmpty: "Sem tracos de desenho.",
  drawingStatusStrokes: (count) => `${count} ${count === 1 ? "traco" : "tracos"} de desenho.`,
  gapLabel: (index) => `Lacuna ${index}`,
  graphicGapTarget: (index) => `Destino ${index}`,
  gapEmpty: (label) => `${label}, vazio`,
  gapAssigned: (label, assigned) => `${label}, atribuido ${assigned}`,
  gapPlaced: (count) => `${count} ${count === 1 ? "rotulo colocado" : "rotulos colocados"}.`,
  gapNonePlaced: "Nenhum rotulo colocado.",
  orderedAt: (label, position, total) => `${label}, posicao ${position} de ${total}`,
  movedStep: (label, direction) =>
    `${label} movido ${direction === "up" ? "para cima" : "para baixo"}.`,
  movedTo: (label, position, total) =>
    `${label} movido para a posicao ${position} de ${total}.`,
  regionsSelected: (count) =>
    `${count} ${count === 1 ? "regiao ordenada" : "regioes ordenadas"}.`,
  noRegionsSelected: "Nenhuma regiao ordenada.",
  objectNotPlaced: "Objeto nao posicionado",
  objectAt: (coords) => `Objeto posicionado em ${coords}`,
  pointAt: (coords) => `Ponto selecionado ${coords}`,
  pointsSummary: (count, coords) =>
    `${count} ${count === 1 ? "ponto selecionado" : "pontos selecionados"}: ${coords}`,
  extendedText: "Resposta de texto estendido",
  textResponse: "Resposta de texto",
  sliderResponse: "Resposta de controle deslizante",
});

export const frenchChromeMessages = buildChromeCatalog(frenchInteractionTypes, {
  matchSources: "Sources de correspondance",
  matchTargets: "Cibles de correspondance",
  matchPairs: "Paires selectionnees",
  sourcesBank: (name) => `Sources de ${name}`,
  targetsBank: (name) => `Cibles de ${name}`,
  selectedPairs: (name) => `Paires selectionnees de ${name}`,
  associateFirst: "Premier concept",
  associatePairWith: "Associer avec",
  matchPrompt: "Consigne",
  matchMatch: "Correspondre",
  genericSource: "Source",
  genericTarget: "Cible",
  hotspots: (name) => `Points actifs de ${name}`,
  imageAlt: (name) => `Image de ${name}`,
  currentOrder: (name) => `Ordre actuel de ${name}`,
  selectedOrder: (name) => `Ordre selectionne de ${name}`,
  choicesBank: (name) => `Choix de ${name}`,
  gapTargets: (name) => `Cibles de ${name}`,
  targetImage: (name) => `Image cible de ${name}`,
  options: (name) => `Options de ${name}`,
  coordinateResponse: (name) => `Reponse de coordonnees de ${name}`,
  coordinateArea: (name) => `Zone de coordonnees de ${name}`,
  coordinateAreaSelected: (name, coords) => `Zone de coordonnees de ${name}, selection ${coords}`,
  placementResponse: (name) => `Reponse de placement de ${name}`,
  placementStage: (name) => `Zone de placement de ${name}`,
  placementStageEmpty: (name) => `Zone de placement de ${name}, objet non place`,
  placementStageAt: (name, coords) => `Zone de placement de ${name}, objet a ${coords}`,
  drawingResponse: (name) => `Reponse de ${name}`,
  drawingSurfaceLabel: "Surface de dessin",
  drawingSurfaceEmpty: "Surface de dessin, aucun trait",
  drawingSurfaceStrokes: (count) =>
    `Surface de dessin, ${count} ${count === 1 ? "trait" : "traits"}`,
  drawingStatusEmpty: "Aucun trait de dessin.",
  drawingStatusStrokes: (count) => `${count} ${count === 1 ? "trait" : "traits"} de dessin.`,
  gapLabel: (index) => `Lacune ${index}`,
  graphicGapTarget: (index) => `Cible ${index}`,
  gapEmpty: (label) => `${label}, vide`,
  gapAssigned: (label, assigned) => `${label}, attribue ${assigned}`,
  gapPlaced: (count) => `${count} ${count === 1 ? "etiquette placee" : "etiquettes placees"}.`,
  gapNonePlaced: "Aucune etiquette placee.",
  orderedAt: (label, position, total) => `${label}, position ${position} sur ${total}`,
  movedStep: (label, direction) =>
    `${label} deplace vers ${direction === "up" ? "le haut" : "le bas"}.`,
  movedTo: (label, position, total) =>
    `${label} deplace a la position ${position} sur ${total}.`,
  regionsSelected: (count) =>
    `${count} ${count === 1 ? "region ordonnee" : "regions ordonnees"}.`,
  noRegionsSelected: "Aucune region ordonnee.",
  objectNotPlaced: "Objet non place",
  objectAt: (coords) => `Objet place a ${coords}`,
  pointAt: (coords) => `Point selectionne ${coords}`,
  pointsSummary: (count, coords) =>
    `${count} ${count === 1 ? "point selectionne" : "points selectionnes"}: ${coords}`,
  extendedText: "Reponse de texte etendu",
  textResponse: "Reponse texte",
  sliderResponse: "Reponse du curseur",
});

export { englishDirection };
