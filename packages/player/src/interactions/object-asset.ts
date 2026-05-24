import type { QtiInteraction, QtiObjectAsset, QtiValue } from "@longsightgroup/qti3-core";
import { objectIsImage } from "../interaction-support.js";
import { maximumMediaPlays, mediaPlayCount } from "../response-limits.js";

function parseBooleanAttribute(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

export interface MediaResponseBinding {
  currentValue?: QtiValue | undefined;
  update?: ((value: QtiValue) => void) | undefined;
  isCompleted?: (() => boolean) | undefined;
}

export function renderObjectAsset(
  interaction: QtiInteraction,
  mediaResponse: MediaResponseBinding = {},
): HTMLElement {
  const object = interaction.object;
  const label = interaction.prompt ?? object?.text ?? "Media interaction";
  const mediaType = object ? mediaElementType(object) : undefined;

  if (object && mediaType === "audio") {
    const audio = document.createElement("audio");
    configureMediaElement(audio, interaction, object, label, mediaResponse);
    audio.style.inlineSize = "100%";
    return audio;
  }

  if (object && mediaType === "video") {
    const video = document.createElement("video");
    configureMediaElement(video, interaction, object, label, mediaResponse);
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
    if (object.width) image.width = Number(object.width);
    if (object.height) image.height = Number(object.height);
    return image;
  }

  const group = document.createElement("div");
  group.role = "group";
  group.setAttribute("aria-label", label);
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
  mediaResponse: MediaResponseBinding,
): void {
  media.controls = mediaControlsMode(interaction, object) !== "none";
  media.preload = "none";
  media.autoplay = parseBooleanAttribute(interaction.attributes.autostart) ?? false;
  media.loop = parseBooleanAttribute(interaction.attributes.loop) ?? false;
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

  bindMediaPlayCount(media, interaction, mediaResponse);
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
): string | undefined {
  return (
    interaction.attributes["data-qti-media-player-controls"] ??
    object.attributes["data-qti-media-player-controls"]
  );
}

function bindMediaPlayCount(
  media: HTMLAudioElement | HTMLVideoElement,
  interaction: QtiInteraction,
  mediaResponse: MediaResponseBinding,
): void {
  if (!mediaResponse.update) return;
  let playCount = mediaPlayCount(mediaResponse.currentValue ?? null);
  let activePlaySession = false;
  let readyAfterEnded = false;
  const maximum = maximumMediaPlays(interaction);

  const syncState = () => {
    media.dataset.playCount = String(playCount);
    if (maximum !== undefined && playCount >= maximum && !activePlaySession) {
      media.dataset.maxPlaysReached = "true";
    } else {
      delete media.dataset.maxPlaysReached;
    }
  };

  media.addEventListener("play", () => {
    if (mediaResponse.isCompleted?.()) {
      return;
    }
    if (!activePlaySession && maximum !== undefined && playCount >= maximum) {
      media.pause();
      syncState();
      return;
    }
    if (!activePlaySession && (readyAfterEnded || media.currentTime <= 0.25)) {
      playCount += 1;
      mediaResponse.update?.(playCount);
      activePlaySession = true;
      readyAfterEnded = false;
      syncState();
      return;
    }
    activePlaySession = true;
    readyAfterEnded = false;
    syncState();
  });

  media.addEventListener("ended", () => {
    activePlaySession = false;
    readyAfterEnded = true;
    syncState();
  });

  media.addEventListener("seeked", () => {
    if (!media.paused || media.currentTime > 0.25) return;
    activePlaySession = false;
    readyAfterEnded = false;
    syncState();
  });

  syncState();
}
