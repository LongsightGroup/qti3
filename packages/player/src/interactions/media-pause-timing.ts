import { assertNever } from "@longsightgroup/qti3-core";

/** Authored pause-delay / pause-duration seconds for a media interaction. */
export interface MediaPauseTimingSeconds {
  readonly delaySeconds: number | undefined;
  readonly durationSeconds: number | undefined;
}

/** Whether any pause-timing presentation is authored. */
export function mediaPauseTimingConfigured(seconds: MediaPauseTimingSeconds): boolean {
  return seconds.delaySeconds !== undefined || seconds.durationSeconds !== undefined;
}

/** Whether a play event should be forwarded to the play-count machine. */
export type MediaPlayIntercept = "pass" | "suppress";

/** Pause-delay presentation owned by the player, not the play-count domain. */
export interface MediaPauseTiming {
  interceptPlay(): MediaPlayIntercept;
  onPause(): void;
  onEnded(): void;
}

type PauseOrigin = "idle" | "playing";

type PauseTimingState =
  | { readonly status: "idle" }
  | { readonly status: "playing" }
  | { readonly status: "delaying"; readonly timer: number; readonly origin: PauseOrigin }
  | { readonly status: "holding"; readonly timer: number }
  | {
      readonly status: "resuming";
      readonly origin: PauseOrigin;
      readonly id: number;
    };

function clearStateTimer(state: PauseTimingState): void {
  if (state.status === "delaying" || state.status === "holding") {
    window.clearTimeout(state.timer);
  }
}

/** Drives pause-delay and pause-duration timers against a native media element. */
export function createMediaPauseTiming(
  media: HTMLMediaElement,
  seconds: MediaPauseTimingSeconds,
): MediaPauseTiming {
  let state: PauseTimingState = { status: "idle" };
  let ignoringPause = false;
  let resumeId = 0;

  const pauseInternally = () => {
    ignoringPause = true;
    media.pause();
    ignoringPause = false;
  };

  const clearPauseState = () => {
    delete media.dataset.qtiMediaPlayerPauseState;
  };

  const beginResume = (origin: PauseOrigin) => {
    clearStateTimer(state);
    clearPauseState();
    const id = ++resumeId;
    state = { status: "resuming", origin, id };
    const abandonResume = () => {
      if (state.status !== "resuming" || state.id !== id) return;
      state = { status: origin };
    };
    try {
      void media.play().catch(abandonResume);
    } catch {
      abandonResume();
    }
  };

  const resumeAfterDelay = (origin: PauseOrigin) => {
    const delaySeconds = seconds.delaySeconds;
    if (delaySeconds === undefined || delaySeconds === 0) {
      beginResume(origin);
      return;
    }
    clearStateTimer(state);
    media.dataset.qtiMediaPlayerPauseState = "delay";
    const timer = window.setTimeout(() => {
      if (state.status !== "delaying" || state.timer !== timer) return;
      beginResume(state.origin);
    }, delaySeconds * 1000);
    state = { status: "delaying", timer, origin };
  };

  const startDelay = (origin: PauseOrigin) => {
    pauseInternally();
    resumeAfterDelay(origin);
  };

  const interceptPlay = (): MediaPlayIntercept => {
    switch (state.status) {
      case "resuming":
        state = { status: "playing" };
        return "pass";
      case "holding":
        pauseInternally();
        return "suppress";
      case "idle":
      case "playing":
      case "delaying": {
        if (seconds.delaySeconds !== undefined && seconds.delaySeconds !== 0) {
          const origin = state.status === "delaying" ? state.origin : state.status;
          startDelay(origin);
          return "suppress";
        }
        state = { status: "playing" };
        return "pass";
      }
      default:
        return assertNever(state);
    }
  };

  const onPause = () => {
    if (ignoringPause || state.status !== "playing" || seconds.durationSeconds === undefined) {
      return;
    }
    if (media.ended) return;
    clearStateTimer(state);
    media.dataset.qtiMediaPlayerPauseState = "pause";
    const durationSeconds = seconds.durationSeconds;
    const timer = window.setTimeout(() => {
      if (state.status !== "holding" || state.timer !== timer) return;
      resumeAfterDelay("playing");
    }, durationSeconds * 1000);
    state = { status: "holding", timer };
  };

  const onEnded = () => {
    clearStateTimer(state);
    clearPauseState();
    state = { status: "idle" };
  };

  return { interceptPlay, onPause, onEnded };
}
