import { expect, test } from "@playwright/test";
import { expectResponse, loadFixture, pasteXml } from "./player-helpers.js";
import { videoBottomStripLuma } from "./player-media-helpers.js";

test.describe("player media", () => {
  test("renders object-backed media interactions with native controls", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "media");

    const audio = page.locator("qti-assessment-item-player audio");
    await expect(audio).toBeVisible();
    await expect(audio).toHaveAttribute("controls", "");
    await expect(audio).toHaveAttribute("preload", "none");
    await expect(audio).toHaveAttribute("src", /^data:audio\/wav;base64,/);
    await expect(audio).toHaveAccessibleName(/Play the town-hall audio excerpt once/);
    await expect(audio).toHaveAttribute("data-play-count", "0");
  });

  test("renders authored media sources and tracks with native controls", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="video-media" title="video-media" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="false" loop="true">
            <qti-prompt>Watch the delivery clip.</qti-prompt>
            <video width="320" height="180" data-qti-media-player-controls="default">
              <source id="mp4-source" class="primary-source" src="clips/delivery.mp4" type="video/mp4" data-qti-media-variant="primary"/>
              <source src="clips/delivery.webm"/>
              <track id="captions-track" class="caption-track" kind="captions" src="captions/delivery.vtt" srclang="en" label="English" default="default" data-qti-a11y-content-role="captions"/>
            </video>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const video = page.locator("qti-assessment-item-player video");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveAttribute("loop", "");
    await expect(video).toHaveAttribute("width", "320");
    await expect(video).toHaveAttribute("height", "180");
    await expect(video).toHaveAccessibleName("Watch the delivery clip.");
    await expect(video.locator("source").first()).toHaveAttribute("src", "clips/delivery.mp4");
    await expect(video.locator("source").first()).toHaveAttribute("type", "video/mp4");
    await expect(video.locator("source").first()).toHaveAttribute("id", "mp4-source");
    await expect(video.locator("source").first()).toHaveAttribute("class", "primary-source");
    await expect(video.locator("source").first()).toHaveAttribute(
      "data-qti-media-variant",
      "primary",
    );
    await expect(video.locator("source").nth(1)).toHaveAttribute("src", "clips/delivery.webm");
    await expect(video.locator("track")).toHaveAttribute("src", "captions/delivery.vtt");
    await expect(video.locator("track")).toHaveAttribute("kind", "captions");
    await expect(video.locator("track")).toHaveAttribute("srclang", "en");
    await expect(video.locator("track")).toHaveAttribute("label", "English");
    await expect(video.locator("track")).toHaveAttribute("default", "");
    await expect(video.locator("track")).toHaveAttribute("id", "captions-track");
    await expect(video.locator("track")).toHaveAttribute("class", "caption-track");
    await expect(video.locator("track")).toHaveAttribute("data-qti-a11y-content-role", "captions");
  });

  test("honors authored media control suppression without custom chrome", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-controls-none" title="media-controls-none" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="true">
            <object data="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" type="audio/wav" data-qti-media-player-controls="none">Silent audio</object>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    await expect(audio).not.toHaveAttribute("controls", "");
    await expect(audio).toHaveAttribute("autoplay", "");
    await expect(audio).toHaveAttribute("data-qti-media-player-controls", "none");
    await expect(page.locator("qti-assessment-item-player .qti3-actions")).toHaveCount(0);
  });

  test("maps supported media player control tokens to native controls", async ({ page }) => {
    await page.goto("/");

    for (const token of ["default", "play", "rewind", "captions", "audioDescription"] as const) {
      await pasteXml(
        page,
        `
        <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-controls-${token}" title="media-controls-${token}" time-dependent="false">
          <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
          <qti-item-body>
            <qti-media-interaction response-identifier="RESPONSE">
              <audio data-qti-media-player-controls="${token}">
                <source src="audio-${token}.wav" type="audio/wav"/>
              </audio>
            </qti-media-interaction>
          </qti-item-body>
        </qti-assessment-item>
      `,
      );

      const audio = page.locator("qti-assessment-item-player audio");
      await expect(audio).toHaveAttribute("controls", "");
      await expect(audio).toHaveAttribute("data-qti-media-player-controls", token);
    }

    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-controls-combined" title="media-controls-combined" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" data-qti-media-player-controls="play captions">
            <audio>
              <source src="combined.wav" type="audio/wav"/>
            </audio>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    await expect(audio).toHaveAttribute("controls", "");
    await expect(audio).toHaveAttribute("data-qti-media-player-controls", "play captions");
  });

  test("renders visible native video controls for default but not none", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="video-control-visibility" title="video-control-visibility" time-dependent="false">
        <qti-response-declaration identifier="DEFAULT_RESPONSE" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="NONE_RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="DEFAULT_RESPONSE">
            <qti-prompt>Default controls video.</qti-prompt>
            <video width="320" height="180" data-qti-media-player-controls="default">
              <source src="default-controls.mp4" type="video/mp4"/>
            </video>
          </qti-media-interaction>
          <qti-media-interaction response-identifier="NONE_RESPONSE">
            <qti-prompt>No controls video.</qti-prompt>
            <video width="320" height="180" data-qti-media-player-controls="none">
              <source src="no-controls.mp4" type="video/mp4"/>
            </video>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const defaultVideo = page.locator("qti-assessment-item-player video").first();
    const noneVideo = page.locator("qti-assessment-item-player video").nth(1);
    await expect(defaultVideo).toHaveAttribute("controls", "");
    await expect(noneVideo).not.toHaveAttribute("controls", "");

    await defaultVideo.hover();
    const defaultBottom = await videoBottomStripLuma(page, defaultVideo);
    await noneVideo.hover();
    const noneBottom = await videoBottomStripLuma(page, noneVideo);
    expect(
      Math.abs(defaultBottom - noneBottom),
      `default native controls bottom luminance ${defaultBottom}, none ${noneBottom}`,
    ).toBeGreaterThan(4);
  });

  test("applies media pause delay and pause duration timers", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-pause-timing" title="media-pause-timing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE">
            <audio data-qti-media-player-pause-delay="0.02" data-qti-media-player-pause-duration="0.03">
              <source src="timed.wav" type="audio/wav"/>
            </audio>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    const result = await audio.evaluate(async (element) => {
      const media = element as HTMLMediaElement & { __qtiCalls?: string[] };
      const calls: string[] = [];
      media.__qtiCalls = calls;
      media.pause = () => {
        calls.push("pause");
        media.dispatchEvent(new Event("pause"));
      };
      media.play = () => {
        calls.push("play");
        window.setTimeout(() => media.dispatchEvent(new Event("play")), 0);
        return Promise.resolve();
      };

      media.dispatchEvent(new Event("play"));
      const delayState = media.dataset.qtiMediaPlayerPauseState;
      await new Promise((resolve) => window.setTimeout(resolve, 40));
      const playCountAfterDelay = media.dataset.playCount;

      media.dispatchEvent(new Event("pause"));
      const pauseState = media.dataset.qtiMediaPlayerPauseState;
      const callsBeforeDuration = calls.length;
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      const callsDuringDuration = calls.length;
      await new Promise((resolve) => window.setTimeout(resolve, 60));

      return {
        calls,
        delayState,
        pauseState,
        callsBeforeDuration,
        callsDuringDuration,
        finalState: media.dataset.qtiMediaPlayerPauseState,
        playCountAfterDelay,
      };
    });

    expect(result.delayState).toBe("delay");
    expect(result.playCountAfterDelay).toBe("1");
    expect(result.pauseState).toBe("pause");
    expect(result.callsDuringDuration).toBe(result.callsBeforeDuration);
    expect(result.calls).toEqual(["pause", "play", "play"]);
    expect(result.finalState).toBeUndefined();
  });

  test("counts media play experiences without counting pause resume", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-count" title="media-count" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer">
          <qti-correct-response><qti-value>2</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="false" max-plays="2">
            <object data="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" type="audio/wav">Silent audio</object>
          </qti-media-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    await audio.evaluate((element) => element.dispatchEvent(new Event("play")));
    await expectResponse(page, 1);

    await audio.evaluate((element) => {
      element.dispatchEvent(new Event("pause"));
      element.dispatchEvent(new Event("play"));
    });
    await expectResponse(page, 1);

    await audio.evaluate((element) => {
      element.dispatchEvent(new Event("ended"));
      element.dispatchEvent(new Event("play"));
    });
    await expectResponse(page, 2);

    await audio.evaluate((element) => {
      element.dispatchEvent(new Event("ended"));
      element.dispatchEvent(new Event("play"));
    });
    await expectResponse(page, 2);
    await expect(audio).toHaveAttribute("data-max-plays-reached", "true");
  });

  test("blocks scoring until media minimum plays are met", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-min" title="media-min" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer">
          <qti-correct-response><qti-value>2</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="false" min-plays="2">
            <object data="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" type="audio/wav">Silent audio</object>
          </qti-media-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    await audio.evaluate((element) => element.dispatchEvent(new Event("play")));
    await page.locator("#debug-score").click();
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "blocked");
    await expect(page.locator("#events")).toContainText("requires at least 2 plays");

    await audio.evaluate((element) => {
      element.dispatchEvent(new Event("ended"));
      element.dispatchEvent(new Event("play"));
    });
    await page.locator("#debug-score").click();
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "scored");
    await expectResponse(page, 2);
  });
});
