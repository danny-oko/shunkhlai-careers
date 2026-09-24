import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The filesystem half of the file store — no database anywhere in this file.
 *
 * Three properties are worth pinning down, because each of them is a way the
 * store could quietly become dangerous rather than merely broken:
 *
 * - containment: a digest out of the database is the only thing that becomes a
 *   path, and nothing that is not a digest may ever reach `readFile`. This is
 *   the check that stops a corrupted or hostile `stored_file.sha256` reading
 *   `/etc/passwd` and serving it as somebody's CV.
 * - atomicity: a file under a content address must be all of its bytes or none
 *   of them, because the name is a promise about the contents and the route
 *   serving it says `immutable`.
 * - dedupe: identical bytes cost one file, which is the whole reason the names
 *   are digests.
 *
 * Everything is written under a fresh `mkdtemp` directory, pointed at by
 * `UPLOAD_DIR`, and removed afterwards. Nothing here touches the repository,
 * `public/`, or `/var/lib`.
 */

/**
 * `rename` is wrapped rather than mocked away: the real one still runs, and
 * the wrapper records what was renamed from where so the atomicity test can
 * assert the destination is only ever reached by a rename of a complete file.
 */
const renames = vi.hoisted(() => [] as Array<{ from: string; to: string; bytes: Buffer }>);

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    default: actual,
    rename: async (from: string, to: string) => {
      // Read the source before the rename: this is the content that is about
      // to appear, atomically, under the destination name.
      const bytes = await actual.readFile(from);
      renames.push({ from: String(from), to: String(to), bytes });
      return actual.rename(from, to);
    },
  };
});

const { blobPath, deleteBlob, hasBlob, putBlob, readBlob, sha256Hex, uploadRoot } = await import(
  "./store"
);

const roots: string[] = [];
let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "shunhlai-files-"));
  roots.push(root);
  process.env.UPLOAD_DIR = root;
  renames.length = 0;
});

afterEach(() => {
  delete process.env.UPLOAD_DIR;
});

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

const bytesOf = (text: string) => new TextEncoder().encode(text);

/** Every file under the store, as paths relative to the root. */
function tree(dir = root, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? tree(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

describe("uploadRoot", () => {
  it("prefers UPLOAD_DIR over every default", () => {
    expect(uploadRoot()).toBe(root);
  });

  it("falls back to a directory in the checkout, never inside public/", () => {
    delete process.env.UPLOAD_DIR;
    const fallback = uploadRoot();
    expect(fallback.startsWith(process.cwd())).toBe(true);
    // Anything under public/ is served verbatim by Next, which would hand out
    // every applicant's CV to anyone who could guess a digest.
    expect(fallback).not.toContain(`${process.cwd()}/public`);
  });
});

describe("containment", () => {
  /**
   * Each of these is a way a caller-supplied string could try to name a file
   * outside the store. None of them is 64 hex characters, so none of them ever
   * becomes a path.
   */
  const attempts = [
    "../../../etc/passwd",
    "..",
    "/etc/passwd",
    "a/../../../etc/passwd",
    `${"a".repeat(64)}/../../../etc/passwd`,
    `${"a".repeat(62)}/..`,
    "\0",
    `${"a".repeat(63)}\0.png`,
    "A".repeat(64), // uppercase: not the spelling this store writes
    "a".repeat(63), // one short
    "a".repeat(65), // one long
    "",
    "....//....//etc/passwd",
    "%2e%2e%2fetc%2fpasswd",
  ];

  it.each(attempts)("refuses to resolve a path for %j", (attempt) => {
    expect(blobPath(attempt)).toBeNull();
  });

  it.each(attempts)("reads nothing for %j", async (attempt) => {
    await expect(readBlob(attempt)).resolves.toBeNull();
  });

  it("cannot reach a real file that sits outside the store", async () => {
    const outside = join(root, "..", `escape-${randomBytes(4).toString("hex")}.txt`);
    writeFileSync(outside, "secret");
    try {
      // The traversal that would name it, spelled every way a caller could.
      const relative = `../${outside.split("/").pop()}`;
      await expect(readBlob(relative)).resolves.toBeNull();
      await expect(readBlob(outside)).resolves.toBeNull();
      expect(blobPath(relative)).toBeNull();
    } finally {
      rmSync(outside, { force: true });
    }
  });

  it("resolves a real digest to the fanned-out path inside the root", () => {
    const digest = sha256Hex(bytesOf("hello"));
    expect(blobPath(digest)).toBe(join(root, digest.slice(0, 2), digest.slice(2, 4), digest));
  });

  it("deletes nothing for a string that is not a digest", async () => {
    await expect(deleteBlob("../../../etc/passwd")).resolves.toBe(false);
  });
});

describe("putBlob", () => {
  it("names a file by the sha256 of its contents and reads it back", async () => {
    const bytes = bytesOf("Танилцуулга.pdf-ийн агуулга");
    const { sha256, byteSize } = await putBlob(bytes);

    expect(sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(byteSize).toBe(bytes.byteLength);
    expect(Buffer.from((await readBlob(sha256))!)).toEqual(Buffer.from(bytes));
    await expect(hasBlob(sha256)).resolves.toBe(true);
  });

  it("fans the digest out two bytes at a time", async () => {
    const { sha256 } = await putBlob(bytesOf("cover"));
    expect(tree()).toContain(`${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`);
  });

  it("stores an empty file rather than nothing at all", async () => {
    const { sha256, byteSize } = await putBlob(new Uint8Array());
    expect(byteSize).toBe(0);
    await expect(hasBlob(sha256)).resolves.toBe(true);
    expect(Buffer.from((await readBlob(sha256))!).byteLength).toBe(0);
  });

  it("writes through a temp file and publishes it with one rename", async () => {
    const bytes = bytesOf("x".repeat(200_000));
    const { sha256 } = await putBlob(bytes);

    expect(renames).toHaveLength(1);
    const [move] = renames;
    // The bytes were already complete at the source: the destination name
    // therefore appears with all of them at once, never as a prefix.
    expect(move.bytes).toEqual(Buffer.from(bytes));
    expect(move.from).toContain("/.tmp/");
    expect(move.from.endsWith(".tmp")).toBe(true);
    expect(move.to).toBe(blobPath(sha256));
  });

  it("leaves no temp file behind", async () => {
    await putBlob(bytesOf("one"));
    await putBlob(bytesOf("two"));
    expect(tree().filter((path) => path.endsWith(".tmp"))).toEqual([]);
  });

  it("creates nothing at the destination when the write fails", async () => {
    const bytes = bytesOf("never lands");
    const digest = sha256Hex(bytes);
    // A root that cannot be created: mkdir under a *file* fails.
    const blocker = join(root, "blocked");
    writeFileSync(blocker, "not a directory");
    process.env.UPLOAD_DIR = join(blocker, "store");

    await expect(putBlob(bytes)).rejects.toThrow();
    await expect(readBlob(digest)).resolves.toBeNull();
  });
});

describe("dedupe", () => {
  it("stores identical content once, under one name", async () => {
    const bytes = bytesOf("the same company logo, twice");

    const first = await putBlob(bytes);
    const second = await putBlob(Uint8Array.from(bytes));

    expect(second.sha256).toBe(first.sha256);
    expect(tree()).toEqual([`${first.sha256.slice(0, 2)}/${first.sha256.slice(2, 4)}/${first.sha256}`]);
    // The second call recognised the address and did not write at all.
    expect(renames).toHaveLength(1);
  });

  it("keeps different content apart", async () => {
    const a = await putBlob(bytesOf("cv A"));
    const b = await putBlob(bytesOf("cv B"));

    expect(a.sha256).not.toBe(b.sha256);
    expect(tree()).toHaveLength(2);
    expect(readFileSync(blobPath(a.sha256)!, "utf8")).toBe("cv A");
    expect(readFileSync(blobPath(b.sha256)!, "utf8")).toBe("cv B");
  });

  it("survives concurrent writes of the same bytes", async () => {
    const bytes = bytesOf("uploaded twice at once");
    const results = await Promise.all([putBlob(bytes), putBlob(bytes), putBlob(bytes)]);

    const digests = new Set(results.map((result) => result.sha256));
    expect(digests.size).toBe(1);
    expect(tree()).toHaveLength(1);
    expect(Buffer.from((await readBlob([...digests][0]))!)).toEqual(Buffer.from(bytes));
  });
});

describe("deleteBlob", () => {
  it("removes the bytes and then reads as absent", async () => {
    const { sha256 } = await putBlob(bytesOf("to be collected"));
    await expect(deleteBlob(sha256)).resolves.toBe(true);
    await expect(hasBlob(sha256)).resolves.toBe(false);
    await expect(readBlob(sha256)).resolves.toBeNull();
  });
});
