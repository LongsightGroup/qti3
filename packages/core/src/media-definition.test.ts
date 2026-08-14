import { describe, expect, it } from "vitest";
import {
  applyQtiMediaPlaybackEvent,
  parseQtiMediaDefinition,
  qtiMediaAllowsNativeLoop,
  type QtiMediaDefinition,
  type QtiMediaPlaySession,
} from "./media-definition.js";
import { parseQtiXml } from "./parser.js";
import type { QtiInteraction } from "./types.js";

function mediaXml(attributes: string): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-definition" title="media-definition" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-item-body>
    <qti-media-interaction response-identifier="RESPONSE" ${attributes}>
      <object data="clips/town-hall.mp3" type="audio/mpeg"/>
    </qti-media-interaction>
  </qti-item-body>
</qti-assessment-item>`;
}

function parsedMedia(attributes: string): QtiInteraction {
  const result = parseQtiXml(mediaXml(attributes));
  const interaction = result.document?.item.interactions[0];
  if (!interaction) throw new Error("Expected parsed media interaction.");
  return interaction;
}

function mediaDefinition(overrides: Partial<QtiMediaDefinition> = {}): QtiMediaDefinition {
  return {
    minPlays: 0,
    maxPlays: undefined,
    autostart: false,
    loop: false,
    required: false,
    ...overrides,
  };
}

function session(overrides: Partial<QtiMediaPlaySession> = {}): QtiMediaPlaySession {
  return {
    playCount: 0,
    active: false,
    readyAfterEnded: false,
    ...overrides,
  };
}

describe("QTI media definition", () => {
  it("treats omitted plays and autostart as an optional unlimited interaction", () => {
    const result = parseQtiMediaDefinition(parsedMedia('autostart="false"'));

    expect(result).toEqual({
      ok: true,
      value: {
        minPlays: 0,
        maxPlays: undefined,
        autostart: false,
        loop: false,
        required: false,
      },
    });
  });

  it("defaults minimum plays to 1 when the interaction is required", () => {
    const result = parseQtiMediaDefinition(parsedMedia('required="true"'));

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ minPlays: 1, required: true }),
    });
  });

  it("treats authored max-plays 0 as unlimited", () => {
    const result = parseQtiMediaDefinition(parsedMedia('max-plays="0"'));

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ maxPlays: undefined }),
    });
  });

  it("allows native loop only when looping is unlimited", () => {
    const unlimited = parseQtiMediaDefinition(parsedMedia('loop="true"'));
    const limited = parseQtiMediaDefinition(parsedMedia('loop="true" max-plays="2"'));

    expect(unlimited.ok).toBe(true);
    expect(limited.ok).toBe(true);
    if (!unlimited.ok || !limited.ok) return;
    expect(qtiMediaAllowsNativeLoop(unlimited.value)).toBe(true);
    expect(qtiMediaAllowsNativeLoop(limited.value)).toBe(false);
  });

  it("returns every invalid playback attribute as a focused diagnostic", () => {
    const parsed = parseQtiMediaDefinition(
      parsedMedia('autostart="maybe" loop="sometimes" min-plays="3" max-plays="2"'),
    );
    const result = parseQtiXml(
      mediaXml('autostart="maybe" loop="sometimes" min-plays="3" max-plays="2"'),
    );

    expect(parsed).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "interaction.booleanAttribute",
          message: "qti-media-interaction requires boolean autostart, got maybe.",
        }),
        expect.objectContaining({
          code: "interaction.booleanAttribute",
          message: "qti-media-interaction requires boolean loop, got sometimes.",
        }),
        expect.objectContaining({ code: "interaction.minMax" }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.filter((entry) => entry.code === "interaction.booleanAttribute"),
    ).toHaveLength(2);
  });

  it("rejects a negative min-plays instead of treating it as omitted", () => {
    const result = parseQtiMediaDefinition(parsedMedia('min-plays="-1"'));

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "interaction.integerAttribute",
          message: "qti-media-interaction requires non-negative integer min-plays, got -1.",
        }),
      ],
    });
  });

  it("lets the generic response-shape check diagnose an unsupported base type", () => {
    const result = parseQtiXml(
      `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-base-type" title="media-base-type" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-media-interaction response-identifier="RESPONSE">
      <object data="clips/town-hall.mp3" type="audio/mpeg"/>
    </qti-media-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics
        .filter((entry) => entry.code === "interaction.baseType")
        .map((entry) => entry.message),
    ).toEqual(["qti-media-interaction expects integer base type, got identifier."]);
    const interaction = result.document?.item.interactions[0];
    if (!interaction) throw new Error("Expected parsed media interaction.");
    expect(parseQtiMediaDefinition(interaction)).toEqual({
      ok: true,
      value: expect.objectContaining({ minPlays: 0, maxPlays: undefined }),
    });
  });
});

describe("QTI media play session", () => {
  const limited = mediaDefinition({ maxPlays: 2 });

  it("skips increment during a pause-delay play event", () => {
    expect(
      applyQtiMediaPlaybackEvent(
        session(),
        { kind: "play", currentTime: 0, pauseState: "delay" },
        limited,
      ),
    ).toEqual({
      session: session(),
      increment: false,
      blockPlay: false,
    });
  });

  it("blocks a new play once the maximum has been reached", () => {
    expect(
      applyQtiMediaPlaybackEvent(
        session({ playCount: 2 }),
        { kind: "play", currentTime: 0 },
        limited,
      ),
    ).toEqual({
      session: session({ playCount: 2 }),
      increment: false,
      blockPlay: true,
    });
  });

  it("increments at the start of a play experience", () => {
    expect(
      applyQtiMediaPlaybackEvent(session(), { kind: "play", currentTime: 0 }, limited),
    ).toEqual({
      session: { playCount: 1, active: true, readyAfterEnded: false },
      increment: true,
      blockPlay: false,
    });
  });

  it("does not count a resume of the same play experience", () => {
    expect(
      applyQtiMediaPlaybackEvent(
        session({ playCount: 1, active: true }),
        { kind: "play", currentTime: 12 },
        limited,
      ),
    ).toEqual({
      session: { playCount: 1, active: true, readyAfterEnded: false },
      increment: false,
      blockPlay: false,
    });
  });

  it("increments again after ended when under the maximum", () => {
    const afterEnded = applyQtiMediaPlaybackEvent(
      session({ playCount: 1, active: true }),
      { kind: "ended" },
      limited,
    );

    expect(afterEnded).toEqual({
      session: { playCount: 1, active: false, readyAfterEnded: true },
      increment: false,
      blockPlay: false,
    });
    expect(
      applyQtiMediaPlaybackEvent(afterEnded.session, { kind: "play", currentTime: 0 }, limited),
    ).toEqual({
      session: { playCount: 2, active: true, readyAfterEnded: false },
      increment: true,
      blockPlay: false,
    });
  });

  it("resets the session when seeking back to the start while paused", () => {
    expect(
      applyQtiMediaPlaybackEvent(
        session({ playCount: 1, active: true, readyAfterEnded: true }),
        { kind: "seeked", currentTime: 0.1, paused: true },
        limited,
      ),
    ).toEqual({
      session: { playCount: 1, active: false, readyAfterEnded: false },
      increment: false,
      blockPlay: false,
    });
  });
});
