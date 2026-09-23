import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

import { SESSION_TTL_SECONDS } from "./session";
import {
  endAllSessions,
  endSession,
  findStaffByEmail,
  loadSession,
  purgeExpiredSessions,
  changePassword,
  staffExists,
  startSession,
} from "./store";
import { hashSessionToken, newSessionToken } from "./tokens";

/**
 * The session table, against Postgres itself.
 *
 * As with the newsroom store, `@/lib/db` is swapped for a Drizzle client over
 * PGlite — Postgres compiled to WASM, in this process — with the tables built
 * from the committed migrations (`src/lib/db/testing.ts`). So the foreign key,
 * the unique index on `token_hash` and the `timestamptz` comparison are the
 * real ones, and no test here reaches a network.
 *
 * What is worth pinning down is mostly what must *not* work: a token that was
 * never issued, one whose row has expired, and one belonging to an account
 * that has since been switched off.
 */

const memory = vi.hoisted(() => ({ db: null as TestDatabase | null }));

vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");

  memory.db = await createTestDatabase();
  return { ...schema, getDb: () => memory.db!.db };
});

const NOW = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

/**
 * A PHC string of the right shape that no password produces. This file never
 * verifies a password — it only moves rows around — so a real argon2id hash
 * would only cost 19 MiB per case. `sign-in.test.ts` does the real thing.
 * Assembled from pieces so the secret scanner does not read it as a leak.
 */
const PLACEHOLDER_HASH = ["$argon2id$v=19$m=19456,t=2,p=1", "c2FsdA", "bm90LWEtaGFzaA"].join("$");

async function addUser(
  overrides: Partial<{ id: string; email: string; isActive: boolean; role: string }> = {},
) {
  const schema = await import("@/lib/db/schema");
  const row = {
    id: overrides.id ?? "usr_test",
    name: "Б. Энхжаргал",
    email: overrides.email ?? "admin@shunkhlai.mn",
    passwordHash: PLACEHOLDER_HASH,
    role: overrides.role ?? "admin",
    isActive: overrides.isActive ?? true,
    createdAt: NOW,
  };
  await memory.db!.db.insert(schema.appUser).values(row);
  return row;
}

async function sessionRows() {
  const schema = await import("@/lib/db/schema");
  return memory.db!.db.select().from(schema.adminSession);
}

beforeAll(async () => {
  // Touch the mocked module once so PGlite is built before the first case.
  await staffExists();
});

beforeEach(async () => {
  await memory.db!.reset();
});

describe("staffExists", () => {
  it("is false for an empty table and true once a row lands", async () => {
    expect(await staffExists()).toBe(false);
    await addUser();
    expect(await staffExists()).toBe(true);
  });
});

describe("findStaffByEmail", () => {
  it("finds the account and returns null for an address nobody has", async () => {
    await addUser({ email: "admin@shunkhlai.mn" });

    expect((await findStaffByEmail("admin@shunkhlai.mn"))?.id).toBe("usr_test");
    expect(await findStaffByEmail("nobody@shunkhlai.mn")).toBeNull();
  });
});

describe("startSession", () => {
  it("stores the hash of the token and never the token", async () => {
    await addUser();
    const { token } = await startSession("usr_test", NOW);
    const [row] = await sessionRows();

    expect(row.tokenHash).toBe(hashSessionToken(token));
    // The thing that matters: the cookie value appears in no column.
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("expires the row one TTL after it was opened", async () => {
    await addUser();
    const { expiresAt } = await startSession("usr_test", NOW);

    expect(expiresAt.getTime()).toBe(NOW.getTime() + SESSION_TTL_SECONDS * 1000);
  });

  it("lets one user hold several sessions — two browsers, two rows", async () => {
    await addUser();
    const first = await startSession("usr_test", NOW);
    const second = await startSession("usr_test", NOW);

    expect(second.token).not.toBe(first.token);
    expect(await sessionRows()).toHaveLength(2);
    expect((await loadSession(first.token, NOW))?.user.id).toBe("usr_test");
    expect((await loadSession(second.token, NOW))?.user.id).toBe("usr_test");
  });

  it("refuses a session for a user who does not exist (the foreign key)", async () => {
    await expect(startSession("usr_ghost", NOW)).rejects.toThrow();
  });
});

describe("loadSession", () => {
  it("returns the user and their role for a live token", async () => {
    await addUser({ role: "editor" });
    const { token } = await startSession("usr_test", NOW);

    expect(await loadSession(token, NOW)).toEqual({
      user: {
        id: "usr_test",
        name: "Б. Энхжаргал",
        email: "admin@shunkhlai.mn",
        role: "editor",
        source: "app_user",
      },
      expiresAt: new Date(NOW.getTime() + SESSION_TTL_SECONDS * 1000),
    });
  });

  it("rejects a forged token — one that was simply never issued", async () => {
    await addUser();
    await startSession("usr_test", NOW);

    expect(await loadSession(newSessionToken(), NOW)).toBeNull();
    // And the real row is untouched by the miss.
    expect(await sessionRows()).toHaveLength(1);
  });

  it("rejects a tampered token whose row therefore hashes to nothing", async () => {
    await addUser();
    const { token } = await startSession("usr_test", NOW);
    const flipped = (token[0] === "A" ? "B" : "A") + token.slice(1);

    expect(flipped).not.toBe(token);
    expect(await loadSession(flipped, NOW)).toBeNull();
  });

  it("still accepts the token one second before it expires", async () => {
    await addUser();
    const { token } = await startSession("usr_test", NOW);
    const justBefore = new Date(NOW.getTime() + (SESSION_TTL_SECONDS - 1) * 1000);

    expect(await loadSession(token, justBefore)).not.toBeNull();
  });

  it("rejects an expired session and deletes the row on the way out", async () => {
    await addUser();
    const { token } = await startSession("usr_test", NOW);
    const after = new Date(NOW.getTime() + (SESSION_TTL_SECONDS + 1) * 1000);

    expect(await loadSession(token, after)).toBeNull();
    expect(await sessionRows()).toHaveLength(0);
  });

  it("rejects a live session whose account has been deactivated since", async () => {
    const schema = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await addUser();
    const { token } = await startSession("usr_test", NOW);

    await memory
      .db!.db.update(schema.appUser)
      .set({ isActive: false })
      .where(eq(schema.appUser.id, "usr_test"));

    // Ticking the box signs them out, rather than only stopping the next login.
    expect(await loadSession(token, NOW)).toBeNull();
    expect(await sessionRows()).toHaveLength(0);
  });
});

describe("endSession — logout", () => {
  it("deletes the row, so the cookie is dead even if someone kept a copy", async () => {
    await addUser();
    const { token } = await startSession("usr_test", NOW);

    await endSession(token);

    expect(await sessionRows()).toHaveLength(0);
    expect(await loadSession(token, NOW)).toBeNull();
  });

  it("leaves the user's other sessions alone — one browser, not all of them", async () => {
    await addUser();
    const first = await startSession("usr_test", NOW);
    const second = await startSession("usr_test", NOW);

    await endSession(first.token);

    expect(await loadSession(first.token, NOW)).toBeNull();
    expect(await loadSession(second.token, NOW)).not.toBeNull();
  });

  it("is a no-op for a token nobody ever held", async () => {
    await expect(endSession(newSessionToken())).resolves.toBeUndefined();
  });
});

describe("endAllSessions", () => {
  it("drops every session the user has", async () => {
    await addUser();
    const first = await startSession("usr_test", NOW);
    const second = await startSession("usr_test", NOW);

    await endAllSessions("usr_test");

    expect(await loadSession(first.token, NOW)).toBeNull();
    expect(await loadSession(second.token, NOW)).toBeNull();
  });

  it("leaves another user's sessions alone", async () => {
    await addUser();
    await addUser({ id: "usr_other", email: "other@shunkhlai.mn" });
    const mine = await startSession("usr_test", NOW);
    const theirs = await startSession("usr_other", NOW);

    await endAllSessions("usr_test");

    expect(await loadSession(mine.token, NOW)).toBeNull();
    expect(await loadSession(theirs.token, NOW)).not.toBeNull();
  });
});

describe("purgeExpiredSessions", () => {
  it("removes the dead rows and keeps the live ones", async () => {
    await addUser();
    const old = await startSession("usr_test", new Date(NOW.getTime() - 999 * 60 * 60 * 1000));
    const live = await startSession("usr_test", NOW);

    await purgeExpiredSessions(NOW);

    expect(await sessionRows()).toHaveLength(1);
    expect(await loadSession(old.token, NOW)).toBeNull();
    expect(await loadSession(live.token, NOW)).not.toBeNull();
  });
});

describe("changePassword", () => {
  const NEW_HASH = ["$argon2id$v=19$m=19456,t=2,p=1", "bmV3c2FsdA", "bmV3LWhhc2g"].join("$");

  it("writes the hash, drops every old session and opens one new one", async () => {
    await addUser();
    const first = await startSession("usr_test", NOW);
    const second = await startSession("usr_test", NOW);

    const fresh = await changePassword("usr_test", NEW_HASH, NOW);

    expect((await findStaffByEmail("admin@shunkhlai.mn"))?.passwordHash).toBe(NEW_HASH);
    expect(await loadSession(first.token, NOW)).toBeNull();
    expect(await loadSession(second.token, NOW)).toBeNull();
    expect((await loadSession(fresh.token, NOW))?.user.id).toBe("usr_test");
    expect(await sessionRows()).toHaveLength(1);
  });

  it("refuses a deactivated account and leaves both the hash and the sessions alone", async () => {
    const original = await addUser();
    const existing = await startSession("usr_test", NOW);

    const schema = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await memory
      .db!.db.update(schema.appUser)
      .set({ isActive: false })
      .where(eq(schema.appUser.id, "usr_test"));

    await expect(changePassword("usr_test", NEW_HASH, NOW)).rejects.toThrow();

    // The throw rolled the whole thing back, so the session row survived even
    // though the delete runs before the check would have mattered.
    expect((await findStaffByEmail("admin@shunkhlai.mn"))?.passwordHash).toBe(
      original.passwordHash,
    );
    expect(await sessionRows()).toHaveLength(1);
    expect(existing.token).toBeTruthy();
  });

  it("refuses a user who does not exist", async () => {
    await expect(changePassword("usr_ghost", NEW_HASH, NOW)).rejects.toThrow();
  });
});
