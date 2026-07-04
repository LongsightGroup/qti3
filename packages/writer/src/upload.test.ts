import { describe, expect, it } from "vitest";

import {
  buildQti3UploadItem,
  qti3TrustedXmlFragment,
  validateQti3UploadItem,
  writeQti3AssessmentItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 upload writer", () => {
  it("writes a valid upload item with host upload metadata", () => {
    const xml = buildQti3UploadItem({
      identifier: "upload-1",
      title: "Upload",
      bodyHtml: qti3TrustedXmlFragment("<p>Provide the requested file.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Upload the spreadsheet.</p>"),
      responseIdentifier: "RESPONSE",
      maxFileSize: 1024,
      fileTypes: ".pdf,.xlsx",
      multiple: true,
      classNames: ["qti-upload-large"],
    });

    expect(xml).toContain("<qti-upload-interaction");
    expect(xml).toContain('base-type="file"');
    expect(xml).toContain('data-max-size="1024"');
    expect(xml).toContain('data-file-types=".pdf,.xlsx"');
    expect(xml).toContain('data-multiple="true"');
    expect(xml).toContain('class="qti-upload-large"');
    expect(xml).not.toContain("<qti-response-processing");

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "file",
    });
    expect(item.interactions[0]).toMatchObject({
      type: "upload",
      qtiName: "qti-upload-interaction",
      responseIdentifier: "RESPONSE",
    });
    expect(item.interactions[0]?.attributes).toMatchObject({
      "data-max-size": "1024",
      "data-file-types": ".pdf,.xlsx",
      "data-multiple": "true",
    });
  });

  it("writes optional correct response and match_correct processing through the unified writer", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "upload",
      identifier: "upload-correct-response",
      title: "Upload correct file",
      bodyHtml: qti3TrustedXmlFragment("<p>Upload field notes.</p>"),
      responseIdentifier: "RESPONSE",
      correctResponse: "upload.txt",
    });

    expect(xml).toContain("<qti-correct-response>");
    expect(xml).toContain("<qti-value>upload.txt</qti-value>");
    expect(xml).toContain("rptemplates/match_correct");
    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]?.correctResponse).toBe("upload.txt");
  });

  it("escapes plain text and upload attributes while assembling trusted fragments", () => {
    const xml = buildQti3UploadItem({
      identifier: "upload-escaped",
      title: "Upload <unsafe>",
      bodyHtml: qti3TrustedXmlFragment("<p>Trusted <strong>body</strong>.</p>"),
      responseIdentifier: "RESPONSE",
      fileTypes: `.pdf,"quoted"`,
    });

    expect(xml).toContain('title="Upload &lt;unsafe&gt;"');
    expect(xml).toContain('data-file-types=".pdf,&quot;quoted&quot;"');
    expect(xml).toContain("<strong>body</strong>");
    expectValidParsedItem(xml);
  });

  it("reports diagnostics for invalid upload inputs", () => {
    const diagnostics = validateQti3UploadItem({
      identifier: "bad upload",
      title: "",
      responseIdentifier: "bad response",
      maxFileSize: 0,
      correctResponse: "",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
      scoring: "map_response" as "match_correct",
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "invalid_upload_max_file_size",
        "empty_upload_correct_response",
        "invalid_upload_scoring",
      ]),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
  });

  it("requires a correct response when match_correct scoring is requested", () => {
    expect(
      validateQti3UploadItem({
        identifier: "upload-missing-correct-response",
        title: "Upload",
        scoring: "match_correct",
      }).map((diagnostic) => diagnostic.code),
    ).toContain("missing_upload_correct_response");
  });
});
