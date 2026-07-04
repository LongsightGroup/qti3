import { describe, expect, it } from "vitest";

import {
  buildQti3MediaItem,
  qti3TrustedXmlFragment,
  validateQti3MediaItem,
  writeQti3AssessmentItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 media writer", () => {
  it("writes a valid video media item with captions, transcript, and shared vocabulary", () => {
    const xml = buildQti3MediaItem({
      identifier: "media-video",
      title: "Video",
      bodyHtml: qti3TrustedXmlFragment("<p>Watch the clip.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Play the media.</p>"),
      responseIdentifier: "RESPONSE",
      kind: "video",
      sources: [
        { src: "media.mp4", type: "video/mp4" },
        { src: "media.webm", type: "video/webm" },
      ],
      captionSrc: "captions-en.vtt",
      captionLang: "en",
      transcript: "This is a transcript.",
      autostart: false,
      loop: true,
      minPlays: 1,
      maxPlays: 3,
      coords: "10,10,200,120",
      width: 640,
      height: 360,
      interactionLabel: "videoInteraction",
      sharedVocabulary: {
        "media-player-controls": ["play", "captions"],
        "media-player-pause-delay": 0.25,
        "media-player-pause-duration": 1.5,
      },
    });

    expect(xml).toContain("<qti-media-interaction");
    expect(xml).toContain('autostart="false"');
    expect(xml).toContain('loop="true"');
    expect(xml).toContain('min-plays="1"');
    expect(xml).toContain('max-plays="3"');
    expect(xml).toContain('coords="10,10,200,120"');
    expect(xml).toContain('<track kind="captions" src="captions-en.vtt" srclang="en"/>');
    expect(xml).toContain("<qti-companion-materials-info>");
    expect(xml).toContain('data-qti-media-player-controls="play captions"');

    const item = expectValidParsedItem(xml);
    const interaction = item.interactions[0];
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "integer",
    });
    expect(interaction).toMatchObject({
      type: "media",
      qtiName: "qti-media-interaction",
      responseIdentifier: "RESPONSE",
    });
    expect(interaction.object?.sources).toMatchObject([
      { src: "media.mp4", type: "video/mp4" },
      { src: "media.webm", type: "video/webm" },
    ]);
    expect(interaction.object?.tracks[0]).toMatchObject({
      kind: "captions",
      src: "captions-en.vtt",
      srclang: "en",
    });
  });

  it("writes object media through the unified writer", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "media",
      identifier: "media-object",
      title: "Timeline",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the timeline.</p>"),
      responseIdentifier: "RESPONSE",
      kind: "object",
      sources: [{ src: "timeline.svg", type: "image/svg+xml" }],
      objectLabel: "Presidential timeline",
      width: 480,
      height: 260,
    });

    expect(xml).toContain('<object data="timeline.svg" type="image/svg+xml"');
    const item = expectValidParsedItem(xml);
    expect(item.interactions[0]?.object).toMatchObject({
      data: "timeline.svg",
      type: "image/svg+xml",
      width: "480",
      height: "260",
    });
  });

  it("reports diagnostics for invalid media inputs", () => {
    const diagnostics = validateQti3MediaItem({
      identifier: "bad media",
      title: "",
      responseIdentifier: "bad response",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
      kind: "stream" as "video",
      sources: [{ src: "" }],
      captionSrc: "captions.srt",
      minPlays: 3,
      maxPlays: 2,
      width: 0,
      height: 1.5,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "invalid_media_kind",
        "missing_media_source_src",
        "invalid_media_play_bounds",
        "invalid_media_dimension",
        "invalid_media_caption_kind",
        "invalid_media_caption_src",
      ]),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
  });
});
