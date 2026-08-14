import {
  applyQtiMediaPlaybackEvent,
  mediaPlayerControlsTokens,
  parseQtiMediaDefinition,
  qtiMediaAllowsNativeLoop,
  type QtiInteraction,
  type QtiMediaDefinition,
  type QtiMediaPlaySession,
  type QtiObjectAsset,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { objectIsImage } from "../interaction-support.js";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import { errorView } from "../player-validation.js";
import { mediaPlayCount } from "../response-limits.js";

export interface MediaResponseBinding {
  currentValue?: QtiValue | undefined;
  update?: ((value: QtiValue) => void) | undefined;
  isCompleted?: (() => boolean) | undefined;
}

function invalidMediaView(interaction: QtiInteraction): HTMLElement {
  const alert = errorView(
    interaction.responseIdentifier
      ? `Media interaction (${interaction.responseIdentifier}) has invalid authored attributes.`
      : "Media interaction has invalid authored attributes.",
  );
  alert.classList.add("qti3-media-invalid");
  return alert;
}

export function renderMediaResponse(
  interaction: QtiInteraction,
  mediaResponse: MediaResponseBinding = {},
): HTMLElement {
  const definition = parseQtiMediaDefinition(interaction);
  if (!definition.ok) return invalidMediaView(interaction);

  const regions = createQtiInteractionRegionMarkers(interaction);
  const object = interaction.object;
  const label = interaction.prompt ?? object?.text ?? "Media interaction";
  const mediaType = object ? mediaElementType(object) : undefined;

  if (object && mediaType === "audio") {
    const audio = document.createElement("audio");
    configureMediaElement(audio, interaction, object, label, definition.value, mediaResponse);
    regions.control(audio);
    audio.style.inlineSize = "100%";
    return audio;
  }

  if (object && mediaType === "video") {
    const video = document.createElement("video");
    configureMediaElement(video, interaction, object, label, definition.value, mediaResponse);
    regions.control(video);
    if (object.width) video.width = Number(object.width);
    if (object.height) video.height = Number(object.height);
    return video;
  }

  if (object?.data && objectIsImage(object)) {
    const image = document.createElement("img");
    image.src = object.data;
    image.alt = label;
    image.style.maxInlineSize = "100%";
    image.style.blockSize = "auto";
    regions.control(image);
    if (object.width) image.width = Number(object.width);
    if (object.height) image.height = Number(object.height);
    return image;
  }

  const group = document.createElement("div");
  group.role = "group";
  group.setAttribute("aria-label", label);
  regions.control(group);
  const fallbackHref = object?.data ?? object?.sources.find((source) => source.src)?.src;
  if (fallbackHref) {
    const link = document.createElement("a");
    link.href = fallbackHref;
    link.textContent = object?.text || fallbackHref;
    group.append(link);
  } else {
    group.textContent = label;
  }
  return group;
}

function configureMediaElement(
  media: HTMLAudioElement | HTMLVideoElement,
  interaction: QtiInteraction,
  object: QtiObjectAsset,
  label: string,
  definition: QtiMediaDefinition,
  mediaResponse: MediaResponseBinding,
): void {
  media.controls = mediaControlsMode(interaction, object) !== "none";
  media.preload = "none";
  media.autoplay = definition.autostart;
  media.loop = qtiMediaAllowsNativeLoop(definition);
  media.setAttribute("aria-label", label);
  media.style.maxInlineSize = "100%";
  copyMediaDataAttributes(media, interaction.attributes);
  copyMediaDataAttributes(media, object.attributes);

  if (object.data) media.src = object.data;
  for (const source of object.sources) {
    if (!source.src) continue;
    const sourceElement = document.createElement("source");
    sourceElement.src = source.src;
    if (source.type) sourceElement.type = source.type;
    copySafeMediaChildAttributes(sourceElement, source.attributes, sourceAttributeNames);
    media.append(sourceElement);
  }
  for (const track of object.tracks) {
    if (!track.src) continue;
    const trackElement = document.createElement("track");
    trackElement.src = track.src;
    if (track.kind) trackElement.kind = track.kind;
    if (track.srclang) trackElement.srclang = track.srclang;
    if (track.label) trackElement.label = track.label;
    if (track.default) trackElement.default = true;
    copySafeMediaChildAttributes(trackElement, track.attributes, trackAttributeNames);
    media.append(trackElement);
  }

  bindMediaPauseTiming(media, interaction, object);
  bindMediaPlayCount(media, definition, mediaResponse);
}

function copyMediaDataAttributes(element: HTMLElement, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (!name.startsWith("data-")) continue;
    element.setAttribute(name, value);
  }
}

const sourceAttributeNames = new Set(["src", "srcset", "type"]);
const trackAttributeNames = new Set(["default", "kind", "label", "src", "srclang"]);

function copySafeMediaChildAttributes(
  element: HTMLElement,
  attributes: Record<string, string>,
  controlledNames: Set<string>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    const normalizedName = name.toLowerCase();
    if (controlledNames.has(normalizedName)) continue;
    if (
      normalizedName === "class" ||
      normalizedName === "id" ||
      normalizedName === "title" ||
      normalizedName === "media" ||
      normalizedName === "sizes" ||
      normalizedName.startsWith("data-")
    ) {
      element.setAttribute(name, value);
    }
  }
}

function mediaElementType(object: QtiObjectAsset): "audio" | "video" | undefined {
  const types = [object.type, ...object.sources.map((source) => source.type)].filter(
    (value): value is string => Boolean(value),
  );
  if (types.some((value) => value.startsWith("audio/"))) return "audio";
  if (types.some((value) => value.startsWith("video/"))) return "video";
  return undefined;
}

function mediaControlsMode(
  interaction: QtiInteraction,
  object: QtiObjectAsset,
): "none" | "native" | undefined {
  const value =
    interaction.attributes["data-qti-media-player-controls"] ??
    object.attributes["data-qti-media-player-controls"];
  const tokens = mediaPlayerControlsTokens(value);
  if (tokens.length === 1 && tokens[0] === "none") return "none";
  if (tokens.length > 0) return "native";
  return undefined;
}

function mediaTimingSeconds(
  attributeName: "data-qti-media-player-pause-delay" | "data-qti-media-player-pause-duration",
  interaction: QtiInteraction,
  object: QtiObjectAsset,
): number | undefined {
  const value = interaction.attributes[attributeName] ?? object.attributes[attributeName];
  if (value === undefined) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds;
}

function bindMediaPauseTiming(
  media: HTMLAudioElement | HTMLVideoElement,
  interaction: QtiInteraction,
  object: QtiObjectAsset,
): void {
  const pauseDelaySeconds = mediaTimingSeconds(
    "data-qti-media-player-pause-delay",
    interaction,
    object,
  );
  const pauseDurationSeconds = mediaTimingSeconds(
    "data-qti-media-player-pause-duration",
    interaction,
    object,
  );
  if (pauseDelaySeconds === undefined && pauseDurationSeconds === undefined) return;

  let internalPause = false;
  let qtiTimerResume = false;
  let delayTimer: number | undefined;
  let durationTimer: number | undefined;
  let pauseWindowActive = false;
  let resumeAfterPauseWindow = false;
  let playbackHasStarted = false;

  const clearDelayTimer = () => {
    if (delayTimer === undefined) return;
    window.clearTimeout(delayTimer);
    delayTimer = undefined;
  };

  const clearDurationTimer = () => {
    if (durationTimer === undefined) return;
    window.clearTimeout(durationTimer);
    durationTimer = undefined;
  };

  const resumePlayback = () => {
    qtiTimerResume = true;
    delete media.dataset.qtiMediaPlayerPauseState;
    try {
      void media.play().catch(() => {
        qtiTimerResume = false;
      });
    } catch {
      qtiTimerResume = false;
    }
  };

  const resumeAfterDelay = () => {
    if (pauseDelaySeconds === undefined || pauseDelaySeconds === 0) {
      resumePlayback();
      return;
    }
    media.dataset.qtiMediaPlayerPauseState = "delay";
    delayTimer = window.setTimeout(() => {
      delayTimer = undefined;
      resumePlayback();
    }, pauseDelaySeconds * 1000);
  };

  const pauseForDelay = () => {
    internalPause = true;
    media.pause();
    internalPause = false;
    resumeAfterDelay();
  };

  media.addEventListener(
    "play",
    () => {
      if (qtiTimerResume) {
        qtiTimerResume = false;
        playbackHasStarted = true;
        return;
      }

      if (pauseWindowActive) {
        resumeAfterPauseWindow = true;
        internalPause = true;
        media.pause();
        internalPause = false;
        return;
      }

      if (pauseDelaySeconds === undefined || pauseDelaySeconds === 0) {
        playbackHasStarted = true;
        return;
      }

      clearDelayTimer();
      pauseForDelay();
    },
    { capture: true },
  );

  media.addEventListener("pause", () => {
    if (internalPause || !playbackHasStarted || pauseDurationSeconds === undefined) return;
    if (media.ended) return;
    clearDurationTimer();
    pauseWindowActive = true;
    resumeAfterPauseWindow = true;
    media.dataset.qtiMediaPlayerPauseState = "pause";
    durationTimer = window.setTimeout(() => {
      durationTimer = undefined;
      pauseWindowActive = false;
      if (!resumeAfterPauseWindow) {
        delete media.dataset.qtiMediaPlayerPauseState;
        return;
      }
      resumeAfterPauseWindow = false;
      resumeAfterDelay();
    }, pauseDurationSeconds * 1000);
  });

  media.addEventListener("ended", () => {
    playbackHasStarted = false;
    pauseWindowActive = false;
    resumeAfterPauseWindow = false;
    clearDelayTimer();
    clearDurationTimer();
    delete media.dataset.qtiMediaPlayerPauseState;
  });
}

function mediaPauseState(
  media: HTMLAudioElement | HTMLVideoElement,
): "delay" | "pause" | undefined {
  const value = media.dataset.qtiMediaPlayerPauseState;
  if (value === "delay" || value === "pause") return value;
  return undefined;
}

function bindMediaPlayCount(
  media: HTMLAudioElement | HTMLVideoElement,
  definition: QtiMediaDefinition,
  mediaResponse: MediaResponseBinding,
): void {
  if (!mediaResponse.update) return;
  let session: QtiMediaPlaySession = {
    playCount: mediaPlayCount(mediaResponse.currentValue ?? null),
    active: false,
    readyAfterEnded: false,
  };

  const syncState = () => {
    media.dataset.playCount = String(session.playCount);
    if (
      definition.maxPlays !== undefined &&
      session.playCount >= definition.maxPlays &&
      !session.active
    ) {
      media.dataset.maxPlaysReached = "true";
    } else {
      delete media.dataset.maxPlaysReached;
    }
  };

  media.addEventListener("play", () => {
    if (mediaResponse.isCompleted?.()) return;
    const pauseState = mediaPauseState(media);
    const result = applyQtiMediaPlaybackEvent(
      session,
      pauseState === undefined
        ? { kind: "play", currentTime: media.currentTime }
        : { kind: "play", currentTime: media.currentTime, pauseState },
      definition,
    );
    session = result.session;
    if (result.increment) mediaResponse.update?.(session.playCount);
    if (result.blockPlay) media.pause();
    syncState();
  });

  media.addEventListener("ended", () => {
    const result = applyQtiMediaPlaybackEvent(session, { kind: "ended" }, definition);
    session = result.session;
    syncState();
  });

  media.addEventListener("seeked", () => {
    const result = applyQtiMediaPlaybackEvent(
      session,
      { kind: "seeked", currentTime: media.currentTime, paused: media.paused },
      definition,
    );
    session = result.session;
    syncState();
  });

  syncState();
}
