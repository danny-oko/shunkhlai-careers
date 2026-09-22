import { describe, expect, it } from "vitest";

import { CV_TYPE_MESSAGE, PICTURE_TYPE_MESSAGE, uploadProblem } from "./upload-check";

const b64 = (bytes: number[] | string) =>
  (typeof bytes === "string" ? Buffer.from(bytes, "latin1") : Buffer.from(bytes)).toString("base64");

describe("uploadProblem: SaveAppCV", () => {
  const cv = (name: string, type = "") => uploadProblem("SaveAppCV", { name, type, data: b64([1]) });

  it("accepts pdf/doc/docx by extension (any case) with a matching or unknown type", () => {
    expect(cv("a.pdf", "application/pdf")).toBeNull();
    expect(cv("a.DOC", "application/msword")).toBeNull();
    expect(cv("Анкет.docx")).toBeNull();
    expect(cv("a.docx", "application/octet-stream")).toBeNull();
  });

  it("refuses a missing or other extension, and a reported type that is not a CV type", () => {
    for (const [name, type] of [["a.exe", ""], ["a", "application/pdf"], ["a.pdf", "text/html"], ["a.pdf.js", ""]]) {
      expect(cv(name, type), name).toBe(CV_TYPE_MESSAGE);
    }
  });
});

describe("uploadProblem: SaveAppPicture", () => {
  const pic = (data: string, type = "") => uploadProblem("SaveAppPicture", { name: "photo.jpg", type, data });

  it("accepts JPEG, PNG and WebP by their first bytes", () => {
    expect(pic(b64([0xff, 0xd8, 0xff]))).toBeNull();
    expect(pic(b64([0x89, 0x50, 0x4e, 0x47, 1, 2]), "image/png")).toBeNull();
    expect(pic(b64("RIFF\x00\x00\x00\x00WEBPVP8 "), "image/webp")).toBeNull();
  });

  it("refuses other bytes or another reported type", () => {
    expect(pic(b64("GIF89a"))).toBe(PICTURE_TYPE_MESSAGE);
    expect(pic(b64("<svg/>"), "image/svg+xml")).toBe(PICTURE_TYPE_MESSAGE);
    expect(pic(b64([0xff, 0xd8, 0xff]), "image/gif")).toBe(PICTURE_TYPE_MESSAGE);
    expect(pic("")).toBe(PICTURE_TYPE_MESSAGE);
  });

  it("checks nothing for other endpoints", () => {
    expect(uploadProblem("SaveHrApplicant", { name: "x", data: "" })).toBeNull();
  });
});
