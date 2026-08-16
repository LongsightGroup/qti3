import { assertNever } from "./assert-never.js";
import { parseXmlBoolean } from "./parser-values.js";
import type { QtiDiagnostic, QtiInteraction } from "./types.js";
import { isNonNegativeInteger } from "./validation-primitives.js";

/** A validated media play-count domain and native playback policy. */
export interface QtiMediaDefinition {
  readonly minPlays: number;
  readonly maxPlays: number | undefined;
  readonly autostart: boolean;
  readonly nativeLoop: boolean;
}

/** The typed result of refining raw media interaction attributes. */
export type QtiMediaDefinitionResult =
  | { readonly ok: true; readonly value: QtiMediaDefinition }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

/** Seconds from the start within which a play event counts as a new play experience. */
export const QTI_MEDIA_RESTART_THRESHOLD_SECONDS = 0.25;

/** The play-experience session used to decide whether a native media event counts. */
export type QtiMediaPlaySession =
  | { readonly status: "idle"; readonly playCount: number }
  | { readonly status: "playing"; readonly playCount: number }
  | { readonly status: "ended"; readonly playCount: number };

/** A native media event projected into the QTI play-count machine. */
export type QtiMediaPlaybackEvent =
  | { readonly kind: "play"; readonly currentTime: number }
  | { readonly kind: "ended" }
  | { readonly kind: "seeked"; readonly currentTime: number; readonly paused: boolean };

/** The session update and any player-side block from one playback event. */
export type QtiMediaPlaybackResult =
  | { readonly kind: "applied"; readonly session: QtiMediaPlaySession }
  | { readonly kind: "blocked"; readonly session: QtiMediaPlaySession };

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
  attribute: "autostart" | "loop",
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

function atMaximumPlays(session: QtiMediaPlaySession, maxPlays: number | undefined): boolean {
  return maxPlays !== undefined && session.playCount >= maxPlays;
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
  const required = parseXmlBoolean(interaction.attributes.required) === true;
  const maxPlays =
    maxPlaysAttribute === undefined || maxPlaysAttribute <= 0 ? undefined : maxPlaysAttribute;

  if (minPlaysAttribute !== undefined && maxPlays !== undefined && minPlaysAttribute > maxPlays) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.minMax",
        `${interaction.qtiName} requires min-plays to be less than or equal to max-plays, unless max-plays is 0 for unlimited.`,
      ),
    );
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return {
    ok: true,
    value: {
      minPlays: minPlaysAttribute ?? (required ? 1 : 0),
      maxPlays,
      autostart,
      nativeLoop: loop && maxPlays === undefined,
    },
  };
}

function applyPlayEvent(
  session: QtiMediaPlaySession,
  event: Extract<QtiMediaPlaybackEvent, { kind: "play" }>,
  maxPlays: number | undefined,
): QtiMediaPlaybackResult {
  if (session.status !== "playing" && atMaximumPlays(session, maxPlays)) {
    return { kind: "blocked", session };
  }
  const counts =
    session.status === "ended" ||
    (session.status === "idle" && event.currentTime <= QTI_MEDIA_RESTART_THRESHOLD_SECONDS);
  return {
    kind: "applied",
    session: {
      status: "playing",
      playCount: session.playCount + (counts ? 1 : 0),
    },
  };
}

function applySeekedEvent(
  session: QtiMediaPlaySession,
  event: Extract<QtiMediaPlaybackEvent, { kind: "seeked" }>,
): QtiMediaPlaybackResult {
  if (!event.paused || event.currentTime > QTI_MEDIA_RESTART_THRESHOLD_SECONDS) {
    return { kind: "applied", session };
  }
  return { kind: "applied", session: { status: "idle", playCount: session.playCount } };
}

/** Applies one native media event to the QTI play-experience session. */
export function applyQtiMediaPlaybackEvent(
  session: QtiMediaPlaySession,
  event: QtiMediaPlaybackEvent,
  maxPlays: number | undefined,
): QtiMediaPlaybackResult {
  switch (event.kind) {
    case "play":
      return applyPlayEvent(session, event, maxPlays);
    case "ended":
      return { kind: "applied", session: { status: "ended", playCount: session.playCount } };
    case "seeked":
      return applySeekedEvent(session, event);
    default:
      return assertNever(event);
  }
}
