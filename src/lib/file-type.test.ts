import { describe, expect, it } from "vitest";

import { ACCEPTED_CV_EXTENSIONS, ACCEPTED_CV_TYPES } from "./apply-schema";
import { FALLBACK_MIME, mimeFromName } from "./file-type";

describe("mimeFromName", () => {
  it("types every CV extension the pickers accept as its accepted MIME type", () => {
    for (const ext of ACCEPTED_CV_EXTENSIONS) {
      expect(ACCEPTED_CV_TYPES).toContain(mimeFromName(`cv${ext}`));
    }
    expect(mimeFromName("a.pdf")).toBe("application/pdf");
    expect(mimeFromName("a.doc")).toBe("application/msword");
    expect(mimeFromName("a.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("ignores case and a Cyrillic name; the photo is JPEG", () => {
    expect(mimeFromName("Анкет Бат.PDF")).toBe("application/pdf");
    expect(mimeFromName("photo.jpg")).toBe("image/jpeg");
  });

  it("falls back to octet-stream for no or an unknown extension", () => {
    for (const name of ["cv", "cv.exe", "", null, undefined, "pdf"]) {
      expect(mimeFromName(name)).toBe(FALLBACK_MIME);
    }
  });
});
