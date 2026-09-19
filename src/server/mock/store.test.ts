import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
type MockGlobal = typeof globalThis & { __careersMockDb?: unknown };

let dir: string;

async function loadStore() {
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.resetModules();
  delete (globalThis as MockGlobal).__careersMockDb;
  return import("./store");
}

const signUp = {
  regno: "УЖ12345678",
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
  vi.unstubAllEnvs();
  delete (globalThis as MockGlobal).__careersMockDb;
  rmSync(dir, { recursive: true, force: true });
});

describe("saveDb / loadDb", () => {
  it("brings an account back after a restart", async () => {
    const first = await loadStore();
    first.createAccount(signUp);
    first.saveDb();

    const second = await loadStore();
    const account = second.findAccount("УЖ12345678");

    expect(account?.password).toBe("80296007");
    expect(account?.profile.firstname).toBe("Болд");
  });

  it("keeps a token issued before the restart resolving", async () => {
    const first = await loadStore();
    const token = first.issueToken(first.createAccount(signUp));
    first.saveDb();

    const second = await loadStore();

    expect(second.accountFromToken(token.access_token)?.regno).toBe(
      "УЖ12345678",
    );
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
    const first = await loadStore();
    const account = first.createAccount(signUp);
    account.profile = { ...account.profile, addr2: "Улаанбаатар" };
    first.saveDb();

    const second = await loadStore();

    expect(second.findAccount("УЖ12345678")?.profile.addr2).toBe("Улаанбаатар");
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

    expect(second.findAccount("УЖ12345678")).toBeUndefined();
    expect(() => second.saveDb()).not.toThrow();
  });
});
