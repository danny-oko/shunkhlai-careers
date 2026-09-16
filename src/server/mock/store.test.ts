import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The mock store keeps registered accounts and issued tokens across a
 * dev-server restart. The failure it exists to prevent is silent: the server
 * comes back empty, and signing in with the right credentials answers with the
 * same message as a wrong password.
 *
 * `store.ts` resolves its file from `process.cwd()` and caches the db on
 * `globalThis`, both at import time — so each case stubs the cwd to a throwaway
 * directory and imports a fresh copy.
 */

type MockGlobal = typeof globalThis & { __careersMockDb?: unknown };

let dir: string;

async function loadStore() {
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.resetModules();
  delete (globalThis as MockGlobal).__careersMockDb;
  return import("./store");
}

/** What `SaveHrAppUser` passes on sign-up. */
const signUp = {
  regno: "УЖ07241252",
  lastname: "Бат",
  firstname: "Болд",
  email: "bold@example.mn",
  mobilephone: "80296007",
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "careers-mock-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  // `stubEnv` outlives `restoreAllMocks`; without this the production case
  // below leaks `NODE_ENV` into whatever runs next.
  vi.unstubAllEnvs();
  delete (globalThis as MockGlobal).__careersMockDb;
  rmSync(dir, { recursive: true, force: true });
});

describe("saveDb / loadDb", () => {
  it("brings an account back after a restart", async () => {
    const first = await loadStore();
    first.createAccount(signUp);
    first.saveDb();

    // A restart: new module instance, no `globalThis` carry-over.
    const second = await loadStore();
    const account = second.findAccount("УЖ07241252");

    expect(account?.password).toBe("80296007");
    expect(account?.profile.firstname).toBe("Болд");
  });

  it("keeps a token issued before the restart resolving", async () => {
    const first = await loadStore();
    const token = first.issueToken(first.createAccount(signUp));
    first.saveDb();

    const second = await loadStore();

    // The browser still holds this token; it must not 401 after a restart.
    expect(second.accountFromToken(token.access_token)?.regno).toBe("УЖ07241252");
  });

  it("carries the id counters over, so ids stay unique", async () => {
    const first = await loadStore();
    first.createAccount(signUp);
    const entry = first.nextEntryId();
    first.saveDb();

    const second = await loadStore();

    expect(second.createAccount({ ...signUp, regno: "УЖ07241253" }).id).toBe(2);
    expect(second.nextEntryId()).toBeGreaterThan(entry);
  });

  it("edits made in place are persisted by a later save", async () => {
    // The route handler mutates account objects directly, which is why the
    // save hook sits in the handler rather than in `createAccount`.
    const first = await loadStore();
    const account = first.createAccount(signUp);
    account.profile = { ...account.profile, addr2: "Улаанбаатар" };
    first.saveDb();

    const second = await loadStore();

    expect(second.findAccount("УЖ07241252")?.profile.addr2).toBe("Улаанбаатар");
  });

  it("writes nothing in production, where the filesystem is read-only", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const store = await loadStore();
    store.createAccount(signUp);
    store.saveDb();

    expect(existsSync(join(dir, ".mock-data", "db.json"))).toBe(false);
  });

  it("starts clean on an unreadable file rather than throwing", async () => {
    const store = await loadStore();
    store.saveDb();
    // Truncated by a dev server killed mid-write, say.
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(dir, ".mock-data", "db.json"), "{ not json", "utf8");

    const second = await loadStore();

    expect(second.findAccount("УЖ07241252")).toBeUndefined();
    expect(() => second.saveDb()).not.toThrow();
  });
});
