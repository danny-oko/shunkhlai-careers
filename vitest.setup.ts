import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll } from "vitest";

/**
 * Every test file gets its own throwaway `UPLOAD_DIR`.
 *
 * Uploaded bytes are files now (`src/server/files/store.ts`), and a test that
 * stores one without saying where would land on the store's development
 * default — a directory inside the checkout. That is how test CVs and covers
 * end up in someone's working tree, and how one test file's leftovers become
 * another's fixture.
 *
 * Done here rather than in each test because the trap is silent: a new test
 * that happens to upload something writes to the checkout and still passes.
 * A file that needs to control the root itself (the store's own tests) simply
 * sets `process.env.UPLOAD_DIR` again.
 *
 * `setupFiles` runs once per test file, in its own worker, so the directory is
 * per file and removed when that file is done.
 */
const uploadDir = mkdtempSync(join(tmpdir(), "shunhlai-uploads-"));
process.env.UPLOAD_DIR = uploadDir;

afterAll(() => {
  rmSync(uploadDir, { recursive: true, force: true });
});
