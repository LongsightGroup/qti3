import {
  englishChromeMessages,
  englishDirection,
  frenchChromeMessages,
  germanChromeMessages,
  portugueseChromeMessages,
  spanishChromeMessages,
  swedishChromeMessages,
} from "./player-chrome-messages.js";
import type { QtiPlayerMessages } from "./player-messages.js";
import type { QtiPlayerMessageOverrides } from "./player-types.js";

type QtiPlayerMessageCatalog = Readonly<Partial<QtiPlayerMessages>>;

const defaultEnglishPlayerMessages: QtiPlayerMessages = {
  remove: () => "Remove",
  removePair: ({ label }) => `Remove ${label}`,
  clearDrawing: () => "Clear drawing",
  clearPoints: () => "Clear points",
  endAttempt: () => "End attempt",
  uploadResponse: () => "Upload response",
  movableObject: () => "Movable object",
  placeObject: () => "Place",
  inlineChoicePrompt: () => "Choose...",
  extendedTextCounter: ({ characters, words }) =>
    `${characters} ${characters === 1 ? "character" : "characters"}, ${words} ${words === 1 ? "word" : "words"}`,
  hotspotSelectionSummary: ({ selection }) => `Selected ${selection}`,
  noPointSelected: () => "No point selected",
  noRegionSelected: () => "No region selected",
  noAssociationsMade: () => "No associations made",
  associationsMade: ({ count }) => `${count} ${count === 1 ? "association" : "associations"} made.`,
  associationPairLabel: ({ source, target }) => `${source} to ${target}`,
  hotspotSelectedChooseAnother: ({ label }) => `${label} selected. Choose another hotspot.`,
  moveChoice: ({ label, direction }) => `Move ${label} ${englishDirection(direction)}`,
  movePoint: ({ direction }) => `Move point ${englishDirection(direction)}`,
  moveObject: ({ direction }) => `Move object ${englishDirection(direction)}`,
  ...englishChromeMessages,
};

const playerMessages = {
  defaultEnglish: defaultEnglishPlayerMessages,
  spanish: {
    remove: () => "Quitar",
    removePair: ({ label }) => `Quitar ${label}`,
    clearDrawing: () => "Borrar dibujo",
    clearPoints: () => "Borrar puntos",
    endAttempt: () => "Finalizar intento",
    uploadResponse: () => "Subir respuesta",
    movableObject: () => "Objeto movible",
    placeObject: () => "Colocar",
    inlineChoicePrompt: () => "Elija...",
    extendedTextCounter: ({ characters, words }) =>
      `${characters} ${characters === 1 ? "caracter" : "caracteres"}, ${words} ${words === 1 ? "palabra" : "palabras"}`,
    hotspotSelectionSummary: ({ selection, count }) =>
      count === 1 ? `Seleccionado ${selection}` : `Seleccionados ${selection}`,
    noPointSelected: () => "Ningun punto seleccionado",
    noRegionSelected: () => "Ninguna region seleccionada",
    noAssociationsMade: () => "Ninguna asociacion realizada",
    associationsMade: ({ count }) =>
      `${count} ${count === 1 ? "asociacion realizada" : "asociaciones realizadas"}.`,
    associationPairLabel: ({ source, target }) => `${source} con ${target}`,
    hotspotSelectedChooseAnother: ({ label }) => `${label} seleccionado. Elija otro punto activo.`,
    moveChoice: ({ label, direction }) => `Mover ${label} ${spanishDirection(direction)}`,
    movePoint: ({ direction }) => `Mover punto ${spanishDirection(direction)}`,
    moveObject: ({ direction }) => `Mover objeto ${spanishDirection(direction)}`,
    ...spanishChromeMessages,
  },
  swedish: {
    remove: () => "Ta bort",
    removePair: ({ label }) => `Ta bort ${label}`,
    clearDrawing: () => "Rensa ritning",
    clearPoints: () => "Rensa punkter",
    endAttempt: () => "Avsluta forsok",
    uploadResponse: () => "Ladda upp svar",
    movableObject: () => "Flyttbart objekt",
    placeObject: () => "Placera",
    inlineChoicePrompt: () => "Valj...",
    extendedTextCounter: ({ characters, words }) => `${characters} tecken, ${words} ord`,
    hotspotSelectionSummary: ({ selection, count }) =>
      count === 1 ? `Valt ${selection}` : `Valda ${selection}`,
    noPointSelected: () => "Ingen punkt vald",
    noRegionSelected: () => "Ingen region vald",
    noAssociationsMade: () => "Inga associationer gjorda",
    associationsMade: ({ count }) =>
      `${count} ${count === 1 ? "association gjord" : "associationer gjorda"}.`,
    associationPairLabel: ({ source, target }) => `${source} med ${target}`,
    hotspotSelectedChooseAnother: ({ label }) => `${label} valt. Valj en annan hotspot.`,
    moveChoice: ({ label, direction }) => `Flytta ${label} ${swedishDirection(direction)}`,
    movePoint: ({ direction }) => `Flytta punkt ${swedishDirection(direction)}`,
    moveObject: ({ direction }) => `Flytta objekt ${swedishDirection(direction)}`,
    ...swedishChromeMessages,
  },
  german: {
    remove: () => "Entfernen",
    removePair: ({ label }) => `${label} entfernen`,
    clearDrawing: () => "Zeichnung loeschen",
    clearPoints: () => "Punkte loeschen",
    endAttempt: () => "Versuch beenden",
    uploadResponse: () => "Antwort hochladen",
    movableObject: () => "Bewegliches Objekt",
    placeObject: () => "Platzieren",
    inlineChoicePrompt: () => "Waehlen...",
    extendedTextCounter: ({ characters, words }) =>
      `${characters} ${characters === 1 ? "Zeichen" : "Zeichen"}, ${words} ${words === 1 ? "Wort" : "Worter"}`,
    hotspotSelectionSummary: ({ selection, count }) =>
      count === 1 ? `Ausgewaehlt ${selection}` : `Ausgewaehlt ${selection}`,
    noPointSelected: () => "Kein Punkt ausgewaehlt",
    noRegionSelected: () => "Keine Region ausgewaehlt",
    noAssociationsMade: () => "Keine Zuordnungen erstellt",
    associationsMade: ({ count }) =>
      `${count} ${count === 1 ? "Zuordnung erstellt" : "Zuordnungen erstellt"}.`,
    associationPairLabel: ({ source, target }) => `${source} mit ${target}`,
    hotspotSelectedChooseAnother: ({ label }) =>
      `${label} ausgewaehlt. Waehlen Sie einen weiteren Hotspot.`,
    moveChoice: ({ label, direction }) => `${label} ${germanDirection(direction)} bewegen`,
    movePoint: ({ direction }) => `Punkt ${germanDirection(direction)} bewegen`,
    moveObject: ({ direction }) => `Objekt ${germanDirection(direction)} bewegen`,
    ...germanChromeMessages,
  },
  portuguese: {
    remove: () => "Remover",
    removePair: ({ label }) => `Remover ${label}`,
    clearDrawing: () => "Limpar desenho",
    clearPoints: () => "Limpar pontos",
    endAttempt: () => "Finalizar tentativa",
    uploadResponse: () => "Enviar resposta",
    movableObject: () => "Objeto movel",
    placeObject: () => "Posicionar",
    inlineChoicePrompt: () => "Escolha...",
    extendedTextCounter: ({ characters, words }) =>
      `${characters} ${characters === 1 ? "caractere" : "caracteres"}, ${words} ${words === 1 ? "palavra" : "palavras"}`,
    hotspotSelectionSummary: ({ selection, count }) =>
      count === 1 ? `Selecionado ${selection}` : `Selecionados ${selection}`,
    noPointSelected: () => "Nenhum ponto selecionado",
    noRegionSelected: () => "Nenhuma regiao selecionada",
    noAssociationsMade: () => "Nenhuma associacao feita",
    associationsMade: ({ count }) =>
      `${count} ${count === 1 ? "associacao feita" : "associacoes feitas"}.`,
    associationPairLabel: ({ source, target }) => `${source} com ${target}`,
    hotspotSelectedChooseAnother: ({ label }) => `${label} selecionado. Escolha outro ponto ativo.`,
    moveChoice: ({ label, direction }) => `Mover ${label} ${portugueseDirection(direction)}`,
    movePoint: ({ direction }) => `Mover ponto ${portugueseDirection(direction)}`,
    moveObject: ({ direction }) => `Mover objeto ${portugueseDirection(direction)}`,
    ...portugueseChromeMessages,
  },
  french: {
    remove: () => "Supprimer",
    removePair: ({ label }) => `Supprimer ${label}`,
    clearDrawing: () => "Effacer le dessin",
    clearPoints: () => "Effacer les points",
    endAttempt: () => "Terminer la tentative",
    uploadResponse: () => "Televerser la reponse",
    movableObject: () => "Objet mobile",
    placeObject: () => "Placer",
    inlineChoicePrompt: () => "Choisir...",
    extendedTextCounter: ({ characters, words }) =>
      `${characters} ${characters === 1 ? "caractere" : "caracteres"}, ${words} ${words === 1 ? "mot" : "mots"}`,
    hotspotSelectionSummary: ({ selection, count }) =>
      count === 1 ? `${selection} selectionne` : `${selection} selectionnes`,
    noPointSelected: () => "Aucun point selectionne",
    noRegionSelected: () => "Aucune region selectionnee",
    noAssociationsMade: () => "Aucune association effectuee",
    associationsMade: ({ count }) =>
      `${count} ${count === 1 ? "association effectuee" : "associations effectuees"}.`,
    associationPairLabel: ({ source, target }) => `${source} avec ${target}`,
    hotspotSelectedChooseAnother: ({ label }) =>
      `${label} selectionne. Choisissez un autre point actif.`,
    moveChoice: ({ label, direction }) => `Deplacer ${label} vers ${frenchDirection(direction)}`,
    movePoint: ({ direction }) => `Deplacer le point vers ${frenchDirection(direction)}`,
    moveObject: ({ direction }) => `Deplacer l'objet vers ${frenchDirection(direction)}`,
    ...frenchChromeMessages,
  },
} satisfies Record<string, QtiPlayerMessageCatalog>;

const builtInPlayerMessageCatalogs: ReadonlyMap<string, QtiPlayerMessageCatalog> = new Map([
  ["en", playerMessages.defaultEnglish],
  ["es", playerMessages.spanish],
  ["es-es", playerMessages.spanish],
  ["es-mx", playerMessages.spanish],
  ["sv", playerMessages.swedish],
  ["sv-se", playerMessages.swedish],
  ["de", playerMessages.german],
  ["de-de", playerMessages.german],
  ["pt", playerMessages.portuguese],
  ["pt-br", playerMessages.portuguese],
  ["pt-pt", playerMessages.portuguese],
  ["fr", playerMessages.french],
  ["fr-ca", playerMessages.french],
  ["fr-fr", playerMessages.french],
]);

export function resolvePlayerMessages(
  locale: string,
  overrides: QtiPlayerMessageOverrides,
): QtiPlayerMessages {
  const catalog = builtInPlayerMessageCatalog(locale);
  return { ...defaultEnglishPlayerMessages, ...catalog, ...overrides };
}

function spanishDirection(direction: "up" | "down" | "left" | "right"): string {
  return { up: "arriba", down: "abajo", left: "a la izquierda", right: "a la derecha" }[direction];
}

function swedishDirection(direction: "up" | "down" | "left" | "right"): string {
  return { up: "upp", down: "ned", left: "vanster", right: "hoger" }[direction];
}

function germanDirection(direction: "up" | "down" | "left" | "right"): string {
  return { up: "nach oben", down: "nach unten", left: "nach links", right: "nach rechts" }[
    direction
  ];
}

function portugueseDirection(direction: "up" | "down" | "left" | "right"): string {
  return { up: "para cima", down: "para baixo", left: "para a esquerda", right: "para a direita" }[
    direction
  ];
}

function frenchDirection(direction: "up" | "down" | "left" | "right"): string {
  return { up: "le haut", down: "le bas", left: "la gauche", right: "la droite" }[direction];
}

function builtInPlayerMessageCatalog(locale: string): QtiPlayerMessageCatalog | undefined {
  for (const candidate of localeFallbacks(locale)) {
    const catalog = builtInPlayerMessageCatalogs.get(candidate);
    if (catalog) return catalog;
  }
  return undefined;
}

function localeFallbacks(locale: string): string[] {
  const normalized = normalizedLocale(locale)?.toLowerCase();
  if (!normalized) return ["en"];
  const parts = normalized.split("-");
  const fallbacks: string[] = [];
  for (let length = parts.length; length > 0; length -= 1) {
    fallbacks.push(parts.slice(0, length).join("-"));
  }
  return fallbacks.includes("en") ? fallbacks : [...fallbacks, "en"];
}

export function normalizedLocale(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    return Intl.getCanonicalLocales(trimmed)[0] ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function defaultPlayerLocale(host?: Element): string {
  const elementLanguage = normalizedLocale(host?.getAttribute("lang"));
  if (elementLanguage) return elementLanguage;

  const navigatorLanguages = globalThis.navigator?.languages ?? [];
  for (const language of navigatorLanguages) {
    const normalized = normalizedLocale(language);
    if (normalized) return normalized;
  }
  return (
    normalizedLocale(globalThis.navigator?.language) ??
    normalizedLocale(host?.closest("[lang]")?.getAttribute("lang")) ??
    normalizedLocale(host?.ownerDocument?.documentElement.lang) ??
    normalizedLocale(globalThis.document?.documentElement.lang) ??
    "en"
  );
}
