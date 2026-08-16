import { describe, expect, it } from "vitest";
import {
  applyQtiMediaPlaybackEvent,
  parseQtiMediaDefinition,
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

function idle(playCount = 0): QtiMediaPlaySession {
  return { status: "idle", playCount };
}

function playing(playCount: number): QtiMediaPlaySession {
  return { status: "playing", playCount };
}

function ended(playCount: number): QtiMediaPlaySession {
  return { status: "ended", playCount };
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
        nativeLoop: false,
      },
    });
  });

  it("defaults minimum plays to 1 when the interaction is required", () => {
    const result = parseQtiMediaDefinition(parsedMedia('required="true"'));

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ minPlays: 1, autostart: false, nativeLoop: false }),
    });
  });

  it("leaves invalid required to the generic boolean check", () => {
    const parsed = parseQtiMediaDefinition(parsedMedia('required="maybe"'));
    const result = parseQtiXml(mediaXml('required="maybe"'));

    expect(parsed).toEqual({
      ok: true,
      value: expect.objectContaining({ minPlays: 0 }),
    });
    expect(
      result.diagnostics.filter((entry) => entry.code === "interaction.booleanAttribute"),
    ).toEqual([
      expect.objectContaining({
        message: "qti-media-interaction requires boolean required, got maybe.",
      }),
    ]);
  });

  it("treats authored max-plays 0 as unlimited", () => {
    const result = parseQtiMediaDefinition(parsedMedia('max-plays="0"'));

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ maxPlays: undefined, nativeLoop: false }),
    });
  });

  it("enables native loop only when looping is unlimited", () => {
    const unlimited = parseQtiMediaDefinition(parsedMedia('loop="true"'));
    const limited = parseQtiMediaDefinition(parsedMedia('loop="true" max-plays="2"'));

    expect(unlimited).toEqual({
      ok: true,
      value: expect.objectContaining({ nativeLoop: true, maxPlays: undefined }),
    });
    expect(limited).toEqual({
      ok: true,
      value: expect.objectContaining({ nativeLoop: false, maxPlays: 2 }),
    });
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
  const maxPlays = 2;

  it("blocks a new play once the maximum has been reached", () => {
    expect(applyQtiMediaPlaybackEvent(idle(2), { kind: "play", currentTime: 0 }, maxPlays)).toEqual(
      {
        kind: "blocked",
        session: idle(2),
      },
    );
  });

  it("counts a play that starts from idle near the beginning", () => {
    expect(applyQtiMediaPlaybackEvent(idle(), { kind: "play", currentTime: 0 }, maxPlays)).toEqual({
      kind: "applied",
      session: playing(1),
    });
  });

  it("does not count a resume of the same play experience", () => {
    expect(
      applyQtiMediaPlaybackEvent(playing(1), { kind: "play", currentTime: 12 }, maxPlays),
    ).toEqual({
      kind: "applied",
      session: playing(1),
    });
  });

  it("counts again after ended when under the maximum", () => {
    const afterEnded = applyQtiMediaPlaybackEvent(playing(1), { kind: "ended" }, maxPlays);

    expect(afterEnded).toEqual({
      kind: "applied",
      session: ended(1),
    });
    expect(
      applyQtiMediaPlaybackEvent(afterEnded.session, { kind: "play", currentTime: 0 }, maxPlays),
    ).toEqual({
      kind: "applied",
      session: playing(2),
    });
  });

  it("resets to idle when seeking back to the start while paused", () => {
    expect(
      applyQtiMediaPlaybackEvent(
        playing(1),
        { kind: "seeked", currentTime: 0.1, paused: true },
        maxPlays,
      ),
    ).toEqual({
      kind: "applied",
      session: idle(1),
    });
  });
});
