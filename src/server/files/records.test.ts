import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

/**
 * The join between `stored_file` and the files on disk, plus the one thing
 * that has to hold while the migration is only half done: a file that has not
 * been moved yet must still read.
 *
 * Both halves are real. The database is PGlite — Postgres compiled to WASM, in
 * this process, with the tables created from the committed migration — so the
 * `stored_file` unique index and the fallback queries are the real ones. The
 * bytes go to the throwaway `UPLOAD_DIR` that `vitest.setup.ts` gives every
 * test file. Nothing reaches a network, and nothing is written outside that
 * temp directory.
 */

const memory = vi.hoisted(() => ({ db: null as TestDatabase | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");
  memory.db = await createTestDatabase();
  return { ...schema, schema, getDb: () => memory.db!.db };
});

const { dropOwnedFile, putOwnedFile, readOwnedFile, statOwnedFile } = await import("./records");
const { hasBlob, sha256Hex } = await import("./store");
const { applicantFile, newsMedia, storedFile } = await import("@/lib/db/schema");
const { getMedia, putMedia, dropMedia } = await import("@/server/news/store");
const accountStore = await import("@/server/applicant/account-store");

const bytesOf = (text: string) => new TextEncoder().encode(text);

beforeAll(async () => {
  // Touch a store function so the mocked module (and its PGlite) is built once.
  await statOwnedFile("news_media", "warmup");
});

beforeEach(async () => {
  await memory.db!.reset();
});

/* --- helpers ------------------------------------------------------------ */

/** Writes a legacy chunked cover, the way the old `putMedia` used to. */
async function legacyCover(key: string, bytes: Uint8Array, contentType: string) {
  const data = Buffer.from(bytes).toString("base64");
  await memory
    .db!.db.insert(newsMedia)
    .values({ key, chunkIndex: 0, contentType, data, createdAt: new Date() });
}

/** Writes a legacy chunked applicant file, in two chunks, as the old writer did. */
async function legacyApplicantFile(
  email: string,
  kind: "cv" | "picture",
  filename: string | null,
  payload: string,
) {
  const half = Math.ceil(payload.length / 2);
  for (const [index, slice] of [payload.slice(0, half), payload.slice(half)].entries()) {
    await memory.db!.db.insert(applicantFile).values({
      id: `${email}-${kind}-${index}`,
      email,
      kind,
      filename: index === 0 ? filename : null,
      chunkIndex: index,
      data: slice,
      createdAt: new Date(),
    });
  }
}

/* --- records ------------------------------------------------------------ */

describe("putOwnedFile", () => {
  it("records the metadata and stores the bytes once", async () => {
    const bytes = bytesOf("a cover");
    await putOwnedFile({
      ownerKind: "news_media",
      ownerKey: "med_abc123",
      bytes,
      contentType: "image/png",
    });

    const row = await statOwnedFile("news_media", "med_abc123");
    expect(row).toMatchObject({
      sha256: sha256Hex(bytes),
      contentType: "image/png",
      byteSize: bytes.byteLength,
      ownerKind: "news_media",
      ownerKey: "med_abc123",
    });
    await expect(hasBlob(row!.sha256)).resolves.toBe(true);
  });

  it("gives two owners of identical content one file on disk", async () => {
    const bytes = bytesOf("the same logo");
    await putOwnedFile({
      ownerKind: "news_media",
      ownerKey: "med_one",
      bytes,
      contentType: "image/png",
    });
    await putOwnedFile({
      ownerKind: "news_media",
      ownerKey: "med_two",
      bytes,
      contentType: "image/png",
    });

    const [a, b] = await Promise.all([
      statOwnedFile("news_media", "med_one"),
      statOwnedFile("news_media", "med_two"),
    ]);
    expect(a!.sha256).toBe(b!.sha256);
    expect(a!.id).not.toBe(b!.id);
  });

  it("replaces an owner's file rather than keeping both", async () => {
    const put = (text: string) =>
      putOwnedFile({
        ownerKind: "applicant_cv",
        ownerKey: "a@example.mn",
        bytes: bytesOf(text),
        contentType: "application/pdf",
        filename: "CV.pdf",
      });

    await put("first");
    const first = (await statOwnedFile("applicant_cv", "a@example.mn"))!;
    await put("second");
    const second = (await statOwnedFile("applicant_cv", "a@example.mn"))!;

    const rows = await memory.db!.db.select().from(storedFile);
    expect(rows).toHaveLength(1);
    expect(second.sha256).not.toBe(first.sha256);
    // The superseded bytes go, because nothing names them any more.
    await expect(hasBlob(first.sha256)).resolves.toBe(false);
    await expect(hasBlob(second.sha256)).resolves.toBe(true);
  });

  it("keeps the bytes when a re-upload is the same file", async () => {
    const bytes = bytesOf("unchanged");
    const put = () =>
      putOwnedFile({
        ownerKind: "applicant_cv",
        ownerKey: "a@example.mn",
        bytes,
        contentType: "application/pdf",
      });

    await put();
    await put();

    const row = (await statOwnedFile("applicant_cv", "a@example.mn"))!;
    await expect(hasBlob(row.sha256)).resolves.toBe(true);
  });
});

describe("dropOwnedFile", () => {
  it("removes the row and the bytes", async () => {
    const bytes = bytesOf("delete me");
    await putOwnedFile({
      ownerKind: "news_media",
      ownerKey: "med_gone",
      bytes,
      contentType: "image/png",
    });

    await dropOwnedFile("news_media", "med_gone");

    expect(await statOwnedFile("news_media", "med_gone")).toBeNull();
    await expect(hasBlob(sha256Hex(bytes))).resolves.toBe(false);
  });

  it("keeps shared bytes alive for the owner that still points at them", async () => {
    const bytes = bytesOf("shared");
    for (const key of ["med_one", "med_two"]) {
      await putOwnedFile({ ownerKind: "news_media", ownerKey: key, bytes, contentType: "image/png" });
    }

    await dropOwnedFile("news_media", "med_one");

    expect(await statOwnedFile("news_media", "med_one")).toBeNull();
    // The other story still shows its cover.
    const survivor = await readOwnedFile("news_media", "med_two");
    expect(survivor!.bytes).toEqual(Buffer.from(bytes));
    await expect(hasBlob(sha256Hex(bytes))).resolves.toBe(true);
  });
});

describe("readOwnedFile", () => {
  it("answers null when the row points at bytes that are gone", async () => {
    await memory.db!.db.insert(storedFile).values({
      id: "fil_orphan",
      sha256: "0".repeat(64),
      contentType: "image/png",
      byteSize: 10,
      ownerKind: "news_media",
      ownerKey: "med_orphan",
      filename: null,
      createdAt: new Date(),
    });

    // Null, not a throw: it reads as "not stored here", which sends the caller
    // to its legacy fallback and ends as a 404 rather than a 500.
    await expect(readOwnedFile("news_media", "med_orphan")).resolves.toBeNull();
  });
});

/* --- the transition ----------------------------------------------------- */

describe("news covers during the move", () => {
  it("serves a cover that is still only chunks", async () => {
    const bytes = bytesOf("legacy cover bytes");
    await legacyCover("med_legacy", bytes, "image/webp");

    const media = await getMedia("med_legacy");
    expect(media).toEqual({ bytes: Buffer.from(bytes), contentType: "image/webp" });
  });

  it("prefers the moved file once one exists", async () => {
    const legacy = bytesOf("stale chunks");
    const moved = bytesOf("the real bytes");
    await legacyCover("med_both", legacy, "image/png");
    await putOwnedFile({
      ownerKind: "news_media",
      ownerKey: "med_both",
      bytes: moved,
      contentType: "image/webp",
    });

    const media = await getMedia("med_both");
    expect(media).toEqual({ bytes: Buffer.from(moved), contentType: "image/webp" });
  });

  it("writes new covers to disk and not to news_media", async () => {
    const key = await putMedia(bytesOf("fresh upload"), "image/avif");

    expect(await memory.db!.db.select().from(newsMedia)).toHaveLength(0);
    const media = await getMedia(key);
    expect(media).toEqual({ bytes: Buffer.from(bytesOf("fresh upload")), contentType: "image/avif" });
  });

  it("deleting a cover clears both homes, so it cannot come back", async () => {
    const bytes = bytesOf("both homes");
    await legacyCover("med_both", bytes, "image/png");
    await putOwnedFile({
      ownerKind: "news_media",
      ownerKey: "med_both",
      bytes,
      contentType: "image/png",
    });

    await dropMedia("med_both");

    expect(await getMedia("med_both")).toBeNull();
    expect(await memory.db!.db.select().from(newsMedia)).toHaveLength(0);
  });

  it("still refuses a URL key and a traversal, as it always did", async () => {
    expect(await getMedia("https://res.cloudinary.com/x/image.png")).toBeNull();
    expect(await getMedia("../../etc/passwd")).toBeNull();
  });
});

describe("applicant files during the move", () => {
  it("reads a CV that is still only chunks", async () => {
    const payload = Buffer.from("legacy cv").toString("base64");
    await legacyApplicantFile("a@example.mn", "cv", "Анкет.pdf", payload);

    const cv = await accountStore.readCv("a@example.mn");
    expect(cv).toEqual({ filename: "Анкет.pdf", data: payload });
    expect(Buffer.from(cv!.data, "base64").toString()).toBe("legacy cv");
  });

  it("reads a photo that is still only chunks, data URL and all", async () => {
    const url = `data:image/jpeg;base64,${Buffer.from("legacy photo").toString("base64")}`;
    await legacyApplicantFile("a@example.mn", "picture", null, url);

    await expect(accountStore.readPicture("a@example.mn")).resolves.toBe(url);
  });

  it("normalises the email before falling back, as the chunked reader did", async () => {
    const payload = Buffer.from("legacy cv").toString("base64");
    await legacyApplicantFile("a@example.mn", "cv", "CV.pdf", payload);

    await expect(accountStore.readCv("  A@Example.MN  ")).resolves.toMatchObject({
      filename: "CV.pdf",
    });
  });

  it("prefers the moved file once one exists", async () => {
    await legacyApplicantFile(
      "a@example.mn",
      "cv",
      "Old.pdf",
      Buffer.from("stale").toString("base64"),
    );
    await putOwnedFile({
      ownerKind: "applicant_cv",
      ownerKey: "a@example.mn",
      bytes: bytesOf("moved"),
      contentType: "application/pdf",
      filename: "New.pdf",
    });

    const cv = await accountStore.readCv("a@example.mn");
    expect(cv!.filename).toBe("New.pdf");
    expect(Buffer.from(cv!.data, "base64").toString()).toBe("moved");
  });

  it("rebuilds a moved photo as the data URL the account page expects", async () => {
    await putOwnedFile({
      ownerKind: "applicant_picture",
      ownerKey: "a@example.mn",
      bytes: bytesOf("photo bytes"),
      contentType: "image/webp",
    });

    await expect(accountStore.readPicture("a@example.mn")).resolves.toBe(
      `data:image/webp;base64,${Buffer.from("photo bytes").toString("base64")}`,
    );
  });

  it("answers null for an applicant with no file in either home", async () => {
    await expect(accountStore.readCv("nobody@example.mn")).resolves.toBeNull();
    await expect(accountStore.readPicture("nobody@example.mn")).resolves.toBeNull();
  });
});
