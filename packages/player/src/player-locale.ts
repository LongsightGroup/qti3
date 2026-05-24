import type { QtiPlayerMessages } from "./player-messages.js";
import type { QtiPlayerMessageOverrides } from "./player-types.js";

const defaultEnglishPlayerMessages: QtiPlayerMessages = {
  remove: () => "Remove",
  removePair: ({ label }) => `Remove ${label}`,
  clearDrawing: () => "Clear drawing",
  clearPoints: () => "Clear points",
  endAttempt: () => "End attempt",
  uploadResponse: () => "Upload response",
  movableObject: () => "Movable object",
  placeObject: () => "Place",
  moveChoice: ({ label, direction }) => `Move ${label} ${direction}`,
  movePoint: ({ direction }) => `Move point ${direction}`,
  moveObject: ({ direction }) => `Move object ${direction}`,
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
    moveChoice: ({ label, direction }) => `Mover ${label} ${spanishDirection(direction)}`,
    movePoint: ({ direction }) => `Mover punto ${spanishDirection(direction)}`,
    moveObject: ({ direction }) => `Mover objeto ${spanishDirection(direction)}`,
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
    moveChoice: ({ label, direction }) => `Flytta ${label} ${swedishDirection(direction)}`,
    movePoint: ({ direction }) => `Flytta punkt ${swedishDirection(direction)}`,
    moveObject: ({ direction }) => `Flytta objekt ${swedishDirection(direction)}`,
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
    moveChoice: ({ label, direction }) => `${label} ${germanDirection(direction)} bewegen`,
    movePoint: ({ direction }) => `Punkt ${germanDirection(direction)} bewegen`,
    moveObject: ({ direction }) => `Objekt ${germanDirection(direction)} bewegen`,
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
    moveChoice: ({ label, direction }) => `Mover ${label} ${portugueseDirection(direction)}`,
    movePoint: ({ direction }) => `Mover ponto ${portugueseDirection(direction)}`,
    moveObject: ({ direction }) => `Mover objeto ${portugueseDirection(direction)}`,
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
    moveChoice: ({ label, direction }) => `Deplacer ${label} vers ${frenchDirection(direction)}`,
    movePoint: ({ direction }) => `Deplacer le point vers ${frenchDirection(direction)}`,
    moveObject: ({ direction }) => `Deplacer l'objet vers ${frenchDirection(direction)}`,
  },
} satisfies Record<string, QtiPlayerMessages>;

const builtInPlayerMessageCatalogs: ReadonlyMap<string, QtiPlayerMessages> = new Map([
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
  return {
    remove: overrides.remove ?? catalog?.remove ?? defaultEnglishPlayerMessages.remove,
    removePair:
      overrides.removePair ?? catalog?.removePair ?? defaultEnglishPlayerMessages.removePair,
    clearDrawing:
      overrides.clearDrawing ?? catalog?.clearDrawing ?? defaultEnglishPlayerMessages.clearDrawing,
    clearPoints:
      overrides.clearPoints ?? catalog?.clearPoints ?? defaultEnglishPlayerMessages.clearPoints,
    endAttempt:
      overrides.endAttempt ?? catalog?.endAttempt ?? defaultEnglishPlayerMessages.endAttempt,
    uploadResponse:
      overrides.uploadResponse ??
      catalog?.uploadResponse ??
      defaultEnglishPlayerMessages.uploadResponse,
    movableObject:
      overrides.movableObject ??
      catalog?.movableObject ??
      defaultEnglishPlayerMessages.movableObject,
    placeObject:
      overrides.placeObject ?? catalog?.placeObject ?? defaultEnglishPlayerMessages.placeObject,
    moveChoice:
      overrides.moveChoice ?? catalog?.moveChoice ?? defaultEnglishPlayerMessages.moveChoice,
    movePoint: overrides.movePoint ?? catalog?.movePoint ?? defaultEnglishPlayerMessages.movePoint,
    moveObject:
      overrides.moveObject ?? catalog?.moveObject ?? defaultEnglishPlayerMessages.moveObject,
  };
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

function builtInPlayerMessageCatalog(locale: string): QtiPlayerMessages | undefined {
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
