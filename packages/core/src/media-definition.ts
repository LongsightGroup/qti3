import { parseXmlBoolean } from "./parser-values.js";
import type { QtiDiagnostic, QtiInteraction } from "./types.js";
import { isNonNegativeInteger } from "./validation-primitives.js";
import { assertNever } from "./assert-never.js";

/** A validated media play-count domain and playback policy. */
export interface QtiMediaDefinition {
  readonly minPlays: number;
  readonly maxPlays: number | undefined;
  readonly autostart: boolean;
  readonly loop: boolean;
  readonly required: boolean;
}

/** The typed result of refining raw media interaction attributes. */
export type QtiMediaDefinitionResult =
  | { readonly ok: true; readonly value: QtiMediaDefinition }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

/** Native HTML loop is allowed only when QTI looping is unlimited. */
export function qtiMediaAllowsNativeLoop(definition: QtiMediaDefinition): boolean {
  return definition.loop && definition.maxPlays === undefined;
}

/** Seconds from the start within which a play event counts as a new play experience. */
export const QTI_MEDIA_RESTART_THRESHOLD_SECONDS = 0.25;

/** The play-experience session used to decide whether a native media event counts. */
export interface QtiMediaPlaySession {
  readonly playCount: number;
  readonly active: boolean;
  readonly readyAfterEnded: boolean;
}

/** A native media event projected into the QTI play-count machine. */
export type QtiMediaPlaybackEvent =
  | {
      readonly kind: "play";
      readonly currentTime: number;
      readonly pauseState?: "delay" | "pause";
    }
  | { readonly kind: "ended" }
  | { readonly kind: "seeked"; readonly currentTime: number; readonly paused: boolean };

/** The session update and player-side effects of one playback event. */
export interface QtiMediaPlaybackResult {
  readonly session: QtiMediaPlaySession;
  readonly increment: boolean;
  readonly blockPlay: boolean;
}

function diagnostic(interaction: QtiInteraction, code: string, message: string): QtiDiagnostic {
  return {
    code,
    severity: "error",
    message,
    path: interaction.source?.path,
    source: interaction.source,
  };
}

function optionalBoolean(
  interaction: QtiInteraction,
  attribute: "autostart" | "loop" | "required",
  diagnostics: QtiDiagnostic[],
): boolean {
  const raw = interaction.attributes[attribute];
  if (raw === undefined) return false;
  const value = parseXmlBoolean(raw);
  if (value !== undefined) return value;
  diagnostics.push(
    diagnostic(
      interaction,
      "interaction.booleanAttribute",
      `${interaction.qtiName} requires boolean ${attribute}, got ${raw}.`,
    ),
  );
  return false;
}

function optionalNonNegativeInteger(
  interaction: QtiInteraction,
  attribute: "min-plays" | "max-plays",
  diagnostics: QtiDiagnostic[],
): number | undefined {
  const raw = interaction.attributes[attribute];
  if (raw === undefined) return undefined;
  if (!isNonNegativeInteger(raw)) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.integerAttribute",
        `${interaction.qtiName} requires non-negative integer ${attribute}, got ${raw}.`,
      ),
    );
    return undefined;
  }
  return Number(raw);
}

function validatePlayLimits(interaction: QtiInteraction, diagnostics: QtiDiagnostic[]): void {
  const min = interaction.attributes["min-plays"];
  const max = interaction.attributes["max-plays"];
  if (
    min === undefined ||
    max === undefined ||
    !isNonNegativeInteger(min) ||
    !isNonNegativeInteger(max) ||
    max === "0"
  ) {
    return;
  }
  if (Number(min) <= Number(max)) return;
  diagnostics.push(
    diagnostic(
      interaction,
      "interaction.minMax",
      `${interaction.qtiName} requires min-plays to be less than or equal to max-plays, unless max-plays is 0 for unlimited.`,
    ),
  );
}

/**
 * Refines raw QTI media attributes into the play-count domain shared by validation and players.
 */
export function parseQtiMediaDefinition(interaction: QtiInteraction): QtiMediaDefinitionResult {
  const diagnostics: QtiDiagnostic[] = [];
  const minPlaysAttribute = optionalNonNegativeInteger(interaction, "min-plays", diagnostics);
  const maxPlaysAttribute = optionalNonNegativeInteger(interaction, "max-plays", diagnostics);
  const autostart = optionalBoolean(interaction, "autostart", diagnostics);
  const loop = optionalBoolean(interaction, "loop", diagnostics);
  const required = optionalBoolean(interaction, "required", diagnostics);
  validatePlayLimits(interaction, diagnostics);

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return {
    ok: true,
    value: {
      minPlays: minPlaysAttribute ?? (required ? 1 : 0),
      maxPlays:
        maxPlaysAttribute === undefined || maxPlaysAttribute <= 0 ? undefined : maxPlaysAttribute,
      autostart,
      loop,
      required,
    },
  };
}

function unchanged(session: QtiMediaPlaySession): QtiMediaPlaybackResult {
  return { session, increment: false, blockPlay: false };
}

function applyPlayEvent(
  session: QtiMediaPlaySession,
  event: Extract<QtiMediaPlaybackEvent, { kind: "play" }>,
  definition: QtiMediaDefinition,
): QtiMediaPlaybackResult {
  if (event.pauseState === "delay") return unchanged(session);
  if (
    !session.active &&
    definition.maxPlays !== undefined &&
    session.playCount >= definition.maxPlays
  ) {
    return { session, increment: false, blockPlay: true };
  }
  if (
    !session.active &&
    (session.readyAfterEnded || event.currentTime <= QTI_MEDIA_RESTART_THRESHOLD_SECONDS)
  ) {
    return {
      session: {
        playCount: session.playCount + 1,
        active: true,
        readyAfterEnded: false,
      },
      increment: true,
      blockPlay: false,
    };
  }
  return {
    session: { ...session, active: true, readyAfterEnded: false },
    increment: false,
    blockPlay: false,
  };
}

function applySeekedEvent(
  session: QtiMediaPlaySession,
  event: Extract<QtiMediaPlaybackEvent, { kind: "seeked" }>,
): QtiMediaPlaybackResult {
  if (!event.paused || event.currentTime > QTI_MEDIA_RESTART_THRESHOLD_SECONDS) {
    return unchanged(session);
  }
  return {
    session: { ...session, active: false, readyAfterEnded: false },
    increment: false,
    blockPlay: false,
  };
}

/** Applies one native media event to the QTI play-experience session. */
export function applyQtiMediaPlaybackEvent(
  session: QtiMediaPlaySession,
  event: QtiMediaPlaybackEvent,
  definition: QtiMediaDefinition,
): QtiMediaPlaybackResult {
  switch (event.kind) {
    case "play":
      return applyPlayEvent(session, event, definition);
    case "ended":
      return {
        session: { ...session, active: false, readyAfterEnded: true },
        increment: false,
        blockPlay: false,
      };
    case "seeked":
      return applySeekedEvent(session, event);
    default:
      return assertNever(event);
  }
}
