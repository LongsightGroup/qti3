import { expect, test } from "@playwright/test";
import {
  PLAIN_EXTENDED_TEXT_ITEM,
  XHTML_EXTENDED_TEXT_COUNTER_ITEM,
  XHTML_EXTENDED_TEXT_ITEM,
} from "./fixtures/extended-text-xhtml-items.js";
import { swedishPlayerMessageCatalog } from "./catalogs/player-message-catalogs.fixture.js";
import {
  currentResponse,
  expectResponse,
  loadFixture,
  pasteXml,
  setPlayerMessageCatalog,
} from "./player-helpers.js";

test.describe("player extended text XHTML", () => {
  test("renders XHTML extended text as a rich text editor", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const editor = player.locator(".qti3-rich-text-editor");
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toHaveAttribute("role", "textbox");
    await expect(editor).toHaveAttribute("aria-multiline", "true");
    await expect(player.locator("textarea")).toHaveCount(0);
    await expect(player.getByRole("toolbar", { name: "Rich text formatting" })).toBeVisible();

    await editor.fill("Plain text");
    await expectResponse(page, "Plain text");
  });

  test("keeps plain extended text on textarea rendering", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, PLAIN_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator("textarea.qti3-textarea")).toBeVisible();
    await expect(player.locator(".qti3-rich-text-editor")).toHaveCount(0);
  });

  test("serializes XHTML extended text toolbar formatting as sanitized markup", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const editor = player.locator(".qti3-rich-text-editor");
    await player.getByRole("button", { name: "Bold" }).click();
    await editor.pressSequentially("Bold");
    await expectResponse(page, "<strong>Bold</strong>");
  });

  test("supports keyboard focus on the rich text toolbar", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const boldButton = player.getByRole("button", { name: "Bold" });
    await boldButton.focus();
    await expect(boldButton).toBeFocused();
    await page.keyboard.press("Enter");
    await player.locator(".qti3-rich-text-editor").pressSequentially("Bold");
    await expectResponse(page, "<strong>Bold</strong>");
  });

  test("moves toolbar focus with arrow keys using roving tabindex", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const boldButton = player.getByRole("button", { name: "Bold" });
    const italicButton = player.getByRole("button", { name: "Italic" });
    await boldButton.focus();
    await expect(boldButton).toHaveAttribute("tabindex", "0");
    await expect(italicButton).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("ArrowRight");
    await expect(italicButton).toBeFocused();
    await expect(italicButton).toHaveAttribute("tabindex", "0");
    await expect(boldButton).toHaveAttribute("tabindex", "-1");
  });

  test("renders every toolbar command as an icon button with an accessible name", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-rich-text-toolbar-group")).toHaveCount(3);

    for (const name of [
      "Bold",
      "Italic",
      "Underline",
      "Bulleted list",
      "Numbered list",
      "Undo",
      "Redo",
    ]) {
      const button = player.getByRole("button", { name });
      await expect(button).toBeVisible();
      await expect(button).toHaveText("");
      await expect(button.locator("svg.qti3-rich-text-toolbar-icon")).toBeVisible();
    }
  });

  test("labels toolbar groups for assistive technologies", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.getByRole("group", { name: "Text formatting" })).toBeVisible();
    await expect(player.getByRole("group", { name: "Lists" })).toBeVisible();
    await expect(player.getByRole("group", { name: "Undo and redo" })).toBeVisible();
  });

  test("uses the host message catalog for rich text toolbar labels", async ({ page }) => {
    await page.goto("/");
    await setPlayerMessageCatalog(page, swedishPlayerMessageCatalog);
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const toolbar = player.getByRole("toolbar", { name: "Formatering av rik text" });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole("group", { name: "Textformatering" })).toBeVisible();
    await expect(toolbar.getByRole("group", { name: "Listor" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Fet" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Kursiv" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Angra" })).toBeVisible();
  });

  test("serializes bulleted list toolbar formatting as sanitized markup", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const editor = player.locator(".qti3-rich-text-editor");
    await player.getByRole("button", { name: "Bulleted list" }).click();
    await editor.pressSequentially("Item one");
    await expectResponse(page, "<ul><li>Item one</li></ul>");
  });

  test("serializes numbered list toolbar formatting as sanitized markup", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const editor = player.locator(".qti3-rich-text-editor");
    await player.getByRole("button", { name: "Numbered list" }).click();
    await editor.pressSequentially("Item one");
    await expectResponse(page, "<ol><li>Item one</li></ol>");
  });

  test("supports undo and redo toolbar commands", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const editor = player.locator(".qti3-rich-text-editor");
    await editor.fill("Hello");
    await expectResponse(page, "Hello");

    await player.getByRole("button", { name: "Undo" }).click();
    await expectResponse(page, "");

    await player.getByRole("button", { name: "Redo" }).click();
    await expectResponse(page, "Hello");
  });

  test("reflects active formatting with aria-pressed on toolbar toggles", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const boldButton = player.getByRole("button", { name: "Bold" });
    await expect(boldButton).toHaveAttribute("aria-pressed", "false");
    await boldButton.click();
    await player.locator(".qti3-rich-text-editor").pressSequentially("Bold");
    await expect(boldButton).toHaveAttribute("aria-pressed", "true");
  });

  test("sanitizes XHTML extended text responses and live editor DOM", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const editor = page.locator("qti-assessment-item-player .qti3-rich-text-editor");
    await editor.evaluate((element) => {
      element.innerHTML =
        '<div onclick="alert(1)">Safe<script>bad()</script><b>bold</b></div><span style="color:red">keep</span>';
      element.dispatchEvent(new InputEvent("input", { bubbles: true }));
    });

    expect(await currentResponse(page)).toBe("<p>Safe<strong>bold</strong></p>keep");
    await expect(editor.locator("p")).not.toHaveAttribute("onclick", /.*/);
    await expect(editor.locator("script")).toHaveCount(0);
    await expect(editor.locator("span")).toHaveCount(0);
  });

  test("removes disallowed embed elements from the live editor DOM on input", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const editor = page.locator("qti-assessment-item-player .qti3-rich-text-editor");
    await editor.evaluate((element) => {
      element.innerHTML = '<p>Before</p><iframe src="https://example.com"></iframe>';
      element.dispatchEvent(new InputEvent("input", { bubbles: true }));
    });

    await expect(editor.locator("iframe")).toHaveCount(0);
    expect(await currentResponse(page)).toBe("<p>Before</p>");
  });

  test("sanitizes pasted HTML in XHTML extended text", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_ITEM);

    const editor = page.locator("qti-assessment-item-player .qti3-rich-text-editor");
    await editor.focus();
    await page.evaluate(async () => {
      const editorElement = document.querySelector(
        "qti-assessment-item-player .qti3-rich-text-editor",
      );
      if (!(editorElement instanceof HTMLElement)) throw new Error("Missing rich text editor.");
      editorElement.focus();
      const data = new DataTransfer();
      data.setData(
        "text/html",
        '<div onclick="alert(1)">Paste<script>bad()</script><b>bold</b></div>',
      );
      editorElement.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
      );
    });

    await expectResponse(page, "<p>Paste<strong>bold</strong></p>");
    await expect(editor.locator("p")).not.toHaveAttribute("onclick", /.*/);
  });

  test("counts XHTML extended text visible characters", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, XHTML_EXTENDED_TEXT_COUNTER_ITEM);

    const editor = page.locator("qti-assessment-item-player .qti3-rich-text-editor");
    await expect(editor).toHaveCSS("--qti3-extended-text-rows", "15");
    await editor.pressSequentially("A concise answer");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toHaveText("16 / 20");
  });
  test("does not show an extended text counter unless authored", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "extendedText");

    await page.locator("qti-assessment-item-player textarea").fill("A concise answer");
    await expectResponse(page, "A concise answer");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toHaveCount(0);
  });

  test("does not show an extended text counter without expected-length", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="extended-text-counter-missing-length" title="extended-text-counter-missing-length" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" class="qti-counter-up"/>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await page.locator("qti-assessment-item-player textarea").fill("A concise answer");
    await expectResponse(page, "A concise answer");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toHaveCount(0);
  });

  test("shows authored extended text character counters", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="extended-text-counter" title="extended-text-counter" time-dependent="false">
  <qti-response-declaration identifier="UP" cardinality="single" base-type="string"/>
  <qti-response-declaration identifier="DOWN" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="UP" class="qti-counter-up" expected-length="20"/>
    <qti-extended-text-interaction response-identifier="DOWN" class="qti-counter-down" expected-length="20"/>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const textareas = page.locator("qti-assessment-item-player textarea");
    await textareas.nth(0).fill("A concise answer");
    await textareas.nth(1).fill("A concise answer");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toContainText([
      "16 / 20",
      "4 / 20",
    ]);
  });
});
