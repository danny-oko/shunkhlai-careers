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

describe("jobList", () => {
  it("filters by salary band, the key standing for its text", async () => {
    const store = await loadStore();
    const band = store.filterData.salarylevel.find(
      (row) => row.text === "2,100,000-2,500,000",
    )!;

    const rows = store.jobList({ salaryLevelID: band.key });
    const bandOf = (entryid: number) =>
      store.postings.find((posting) => posting.entryid === entryid)?.salarylevel;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => bandOf(row.entryid))).toEqual(rows.map(() => band.text));
    expect(rows.length).toBeLessThan(store.jobList({}).length);
  });

  it("accepts the key as the string the query string carries", async () => {
    const store = await loadStore();
    const band = store.filterData.salarylevel.find(
      (row) => row.text === "792,000-1,000,000",
    )!;

    expect(store.jobList({ salaryLevelID: String(band.key) })).toEqual(
      store.jobList({ salaryLevelID: band.key }),
    );
  });

  it("treats a blank or zero salary filter as no filter", async () => {
    const store = await loadStore();
    const all = store.jobList({});

    expect(store.jobList({ salaryLevelID: "" })).toEqual(all);
    expect(store.jobList({ salaryLevelID: 0 })).toEqual(all);
  });

  it("answers empty for a key that names no band, never the whole list", async () => {
    const store = await loadStore();

    expect(store.jobList({ salaryLevelID: 9999 })).toEqual([]);
  });

  it("combines the salary band with the name and location filters", async () => {
    const store = await loadStore();
    const posting = store.postings[0];
    const band = store.filterData.salarylevel.find(
      (row) => row.text === posting.salarylevel,
    )!;
    const location = store.filterData.location.find(
      (row) => row.name === posting.locname,
    )!;

    const rows = store.jobList({
      jobName: posting.posname.slice(0, 5),
      locationid: location.entryid,
      salaryLevelID: band.key,
    });

    expect(rows.map((row) => row.entryid)).toContain(posting.entryid);
  });
});
