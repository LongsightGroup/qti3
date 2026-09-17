import type { QtiBuiltInVariables, QtiDiagnostic, QtiSessionContext, QtiValue } from "./types.js";

export interface QtiSessionEnvironment {
  /** Host context, resolved before template processing. Unspecified fields are empty strings. */
  context?: Partial<QtiSessionContext> | undefined;
  /** Accumulated item-session seconds supplied by a scoring host. */
  duration?: number | undefined;
  /** Monotonic milliseconds supplied by a delivery host; suspension time is excluded. */
  now?: (() => number) | undefined;
}

export function createSessionBuiltIns(
  prior: QtiBuiltInVariables | undefined,
  options: QtiSessionEnvironment,
  report: (diagnostic: QtiDiagnostic) => void,
) {
  const state: QtiBuiltInVariables = {
    numAttempts: prior?.numAttempts ?? 0,
    attemptInProgress: prior?.attemptInProgress ?? false,
    duration: options.duration ?? prior?.duration ?? (options.now ? 0 : null),
    context: {
      candidateIdentifier:
        options.context?.candidateIdentifier ?? prior?.context.candidateIdentifier ?? "",
      testIdentifier: options.context?.testIdentifier ?? prior?.context.testIdentifier ?? "",
      environmentIdentifier:
        options.context?.environmentIdentifier ?? prior?.context.environmentIdentifier ?? "",
    },
  };
  let previousTime = options.now?.();
  let elapsed = state.duration;
  let timingValid = elapsed === null || (Number.isFinite(elapsed) && elapsed >= 0);
  if (!timingValid) state.duration = elapsed = null;

  function captureTime(active: boolean): void {
    if (!options.now) return;
    const current = options.now();
    if (
      !Number.isFinite(current) ||
      previousTime === undefined ||
      !Number.isFinite(previousTime) ||
      current < previousTime
    ) {
      timingValid = false;
      elapsed = state.duration = null;
    } else if (active && elapsed !== null) {
      elapsed += (current - previousTime) / 1000;
      // Preserve clock precision across suspension and restoration.
      state.duration = elapsed;
    }
    previousTime = current;
  }

  function duration(): QtiValue {
    if (state.duration !== null && timingValid) return Math.floor(state.duration * 1000) / 1000;
    report({
      code: timingValid ? "session.duration.unavailable" : "session.duration.invalid",
      severity: "error",
      message: timingValid
        ? "Reading duration requires host-supplied accumulated seconds or a monotonic clock."
        : "Duration requires finite non-negative seconds and a monotonic finite clock.",
    });
    return null;
  }

  return { state, captureTime, duration };
}

export function builtInVariableBaseType(
  identifier: string,
): "integer" | "float" | "identifier" | undefined {
  if (identifier === "numAttempts") return "integer";
  if (identifier === "duration") return "float";
  if (identifier === "completionStatus") return "identifier";
  return undefined;
}
