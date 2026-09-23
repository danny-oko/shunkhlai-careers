import { describe, expect, it } from "vitest";

import { type ApplicantChunk, ownerId, planMove } from "./move-plan";

/**
 * The migration script's planner, tested as what it is: a pure function.
 *
 * No database, no filesystem, no script. This is where the script's two
 * promises live — that a re-run moves nothing it has already moved, and that
 * many chunk rows collapse into the one file they are — so this is where they
 * are pinned down. The script around it is only I/O.
 */

const cv = (email: string, filename: string | null = "CV.pdf"): ApplicantChunk => ({
  email,
  kind: "cv",
  filename,
});

const picture = (email: string): ApplicantChunk => ({ email, kind: "picture", filename: null });

function plan(input: Partial<Parameters<typeof planMove>[0]> = {}) {
  return planMove({
    applicantFiles: [],
    newsMedia: [],
    alreadyStored: [],
    ...input,
  });
}

describe("planMove", () => {
  it("collapses a file's chunk rows into one item", () => {
    const result = plan({
      applicantFiles: [cv("a@example.mn"), cv("a@example.mn"), cv("a@example.mn")],
    });

    expect(result.counts.applicantChunks).toBe(3);
    expect(result.counts.files).toBe(1);
    expect(result.move).toEqual([
      {
        ownerKind: "applicant_cv",
        ownerKey: "a@example.mn",
        filename: "CV.pdf",
        contentType: "application/pdf",
      },
    ]);
  });

  it("keeps a CV and a photo for the same applicant apart", () => {
    const result = plan({ applicantFiles: [cv("a@example.mn"), picture("a@example.mn")] });

    expect(result.counts.files).toBe(2);
    expect(result.move.map((item) => item.ownerKind)).toEqual([
      "applicant_cv",
      "applicant_picture",
    ]);
  });

  it("takes the filename from whichever chunk row carries it", () => {
    // Row order is the database's, not ours: only chunk 0 has the name, and it
    // is not guaranteed to come back first.
    const result = plan({
      applicantFiles: [cv("a@example.mn", null), cv("a@example.mn", "Анкет.docx")],
    });

    expect(result.move[0].filename).toBe("Анкет.docx");
    expect(result.move[0].contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("leaves a photo's content type for the bytes to answer", () => {
    // A photo is stored as a whole `data:` URL, so its type is in the payload
    // the script is about to read — not in any column.
    const result = plan({ applicantFiles: [picture("a@example.mn")] });
    expect(result.move[0].contentType).toBeNull();
  });

  it("takes a cover's content type from its row", () => {
    const result = plan({ newsMedia: [{ key: "med_abc123", contentType: "image/webp" }] });

    expect(result.move).toEqual([
      {
        ownerKind: "news_media",
        ownerKey: "med_abc123",
        filename: null,
        contentType: "image/webp",
      },
    ]);
  });

  it("falls back to null for a cover row with no content type", () => {
    const result = plan({ newsMedia: [{ key: "med_abc123", contentType: "" }] });
    expect(result.move[0].contentType).toBeNull();
  });

  it("is idempotent: a file that already has a row is skipped, not moved", () => {
    const result = plan({
      applicantFiles: [cv("a@example.mn"), cv("b@example.mn")],
      newsMedia: [{ key: "med_abc123", contentType: "image/png" }],
      alreadyStored: [ownerId("applicant_cv", "a@example.mn"), ownerId("news_media", "med_abc123")],
    });

    expect(result.counts).toMatchObject({ files: 3, move: 1, skipped: 2 });
    expect(result.move.map((item) => item.ownerKey)).toEqual(["b@example.mn"]);
    expect(result.skipped.map((item) => item.ownerKey)).toEqual(["a@example.mn", "med_abc123"]);
  });

  it("plans nothing on a second run over the same data", () => {
    const applicantFiles = [cv("a@example.mn"), picture("a@example.mn")];
    const newsMedia = [{ key: "med_abc123", contentType: "image/png" }];

    const first = plan({ applicantFiles, newsMedia });
    const alreadyStored = first.move.map((item) => ownerId(item.ownerKind, item.ownerKey));
    const second = plan({ applicantFiles, newsMedia, alreadyStored });

    expect(second.move).toEqual([]);
    expect(second.counts.skipped).toBe(first.counts.move);
  });

  it("ignores a kind this app never wrote rather than guessing at it", () => {
    const result = plan({
      applicantFiles: [{ email: "a@example.mn", kind: "passport", filename: "x.pdf" }],
    });
    expect(result.counts.files).toBe(0);
  });

  it("ignores rows with no owner to key on", () => {
    const result = plan({
      applicantFiles: [cv("")],
      newsMedia: [{ key: "", contentType: "image/png" }],
    });
    expect(result.counts.files).toBe(0);
  });

  it("orders the work the same way every run", () => {
    const applicantFiles = [cv("z@example.mn"), cv("a@example.mn"), picture("m@example.mn")];
    const newsMedia = [
      { key: "med_zzz", contentType: "image/png" },
      { key: "med_aaa", contentType: "image/png" },
    ];

    const once = plan({ applicantFiles, newsMedia });
    const again = plan({
      applicantFiles: [...applicantFiles].reverse(),
      newsMedia: [...newsMedia].reverse(),
    });

    expect(once.move).toEqual(again.move);
  });

  it("counts chunk rows separately from files", () => {
    const result = plan({
      applicantFiles: [cv("a@example.mn"), cv("a@example.mn")],
      newsMedia: [
        { key: "med_abc123", contentType: "image/png" },
        { key: "med_abc123", contentType: "image/png" },
        { key: "med_def456", contentType: "image/png" },
      ],
    });

    expect(result.counts).toEqual({
      applicantChunks: 2,
      newsMediaChunks: 3,
      files: 3,
      move: 3,
      skipped: 0,
    });
  });
});
