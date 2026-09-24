import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

import {
  ADMIN_PASSWORD_IDENTITY,
  currentAdmin,
  isAdminRequest,
  mayDeleteArticles,
  mayRetryApplications,
  requireAdmin,
  requireAdminUser,
} from "./guard";
import { SESSION_TTL_SECONDS, signAdminSession } from "./session";
import { staffExists, startSession } from "./store";
import { newSessionToken } from "./tokens";

/**
 * The gate, from the cookie inwards.
 *
 * Three fakes, and no more: the cookie jar (`next/headers`), the redirect
 * (`next/navigation`, which throws here so a test can see it happen) and the
 * database, which is PGlite as everywhere else. The cookie values are real —
 * a real session token, a real HMAC stamp — so what is being tested is the
 * guard's decision and not a mock of it.
 */

vi.hoisted(() => {
  // Read once, when `./session` loads, so it has to be set before the imports.
  process.env.ADMIN_PASSWORD = "the-old-shared-password";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
});

const memory = vi.hoisted(() => ({
  db: null as TestDatabase | null,
  /** A statement matching this throws, as an unreachable database would. */
  failOn: null as RegExp | null,
  cookie: null as string | null,
  /** Every statement that reached the database, so a test can count them. */
  queries: [] as string[],
}));

vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");

  memory.db = await createTestDatabase({
    onQuery: (sql) => {
      memory.queries.push(sql);
      if (memory.failOn?.test(sql)) throw new Error("database unavailable");
    },
  });
  return { ...schema, getDb: () => memory.db!.db };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      memory.cookie === null ? undefined : { name, value: memory.cookie },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    // Next's own `redirect` throws too; this one carries the target so the
    // test can assert on where an unauthenticated caller is sent.
    throw new Error(`REDIRECT ${url}`);
  },
}));

const NOW = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

/** Shaped like an argon2id hash, matching no password. Nothing here verifies one. */
const PLACEHOLDER_HASH = ["$argon2id$v=19$m=19456,t=2,p=1", "c2FsdA", "bm90LWEtaGFzaA"].join("$");

async function addUser(isActive = true) {
  const schema = await import("@/lib/db/schema");
  await memory.db!.db.insert(schema.appUser).values({
    id: "usr_test",
    name: "Б. Энхжаргал",
    email: "admin@shunkhlai.mn",
    passwordHash: PLACEHOLDER_HASH,
    role: "editor",
    isActive,
    createdAt: NOW,
  });
}

beforeAll(async () => {
  await staffExists();
});

beforeEach(async () => {
  await memory.db!.reset();
  memory.failOn = null;
  memory.cookie = null;
  memory.queries = [];
});

describe("currentAdmin — a database session", () => {
  it("returns the user and their role for a live cookie", async () => {
    await addUser();
    const { token } = await startSession("usr_test");
    memory.cookie = token;

    expect(await currentAdmin()).toEqual({
      id: "usr_test",
      name: "Б. Энхжаргал",
      email: "admin@shunkhlai.mn",
      role: "editor",
      source: "app_user",
    });
  });

  it("is null with no cookie at all", async () => {
    expect(await currentAdmin()).toBeNull();
  });

  it("is null for a forged token — 43 valid-looking characters, no row", async () => {
    await addUser();
    await startSession("usr_test");
    memory.cookie = newSessionToken();

    expect(await currentAdmin()).toBeNull();
  });

  it("is null for an expired session", async () => {
    await addUser();
    const { token } = await startSession(
      "usr_test",
      new Date(Date.now() - (SESSION_TTL_SECONDS + 60) * 1000),
    );
    memory.cookie = token;

    expect(await currentAdmin()).toBeNull();
  });

  it("is null for junk in the cookie, without a query going out", async () => {
    await addUser();
    memory.queries = [];

    // Anything that is not a token shape and not a stamp is refused on shape,
    // before the database is asked anything. Counting the statements is the
    // only way to see that — a query that went out and failed would still
    // produce null, so `toBeNull()` alone proves nothing about it.
    for (const value of ["", "   ", "abc", "{}", "../../etc/passwd", "a".repeat(200)]) {
      memory.cookie = value;
      expect(await currentAdmin(), value).toBeNull();
    }

    expect(memory.queries).toEqual([]);
  });

  it("does query for something shaped like a token", async () => {
    // The counter above is only evidence if it moves when it should.
    await addUser();
    memory.queries = [];
    memory.cookie = newSessionToken();

    expect(await currentAdmin()).toBeNull();
    expect(memory.queries.length).toBeGreaterThan(0);
  });

  it("fails closed when the database cannot be reached", async () => {
    await addUser();
    const { token } = await startSession("usr_test");
    memory.cookie = token;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    memory.failOn = /select/iu;

    // Not a crash, and certainly not an open door: no identity.
    expect(await currentAdmin()).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("currentAdmin — the ADMIN_PASSWORD fallback", () => {
  it("accepts a valid HMAC stamp while app_user is empty", async () => {
    memory.cookie = signAdminSession();
    expect(await currentAdmin()).toEqual(ADMIN_PASSWORD_IDENTITY);
  });

  it("stops accepting it the moment a staff account exists", async () => {
    memory.cookie = signAdminSession();
    expect(await currentAdmin()).not.toBeNull();

    await addUser();

    // A stamp already in someone's browser stops working too, not only new
    // sign-ins: the fallback closes behind the first account.
    expect(await currentAdmin()).toBeNull();
  });

  it("rejects a forged stamp", async () => {
    const [exp, signature] = signAdminSession().split(".");
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    memory.cookie = `${exp}.${flipped}`;

    expect(await currentAdmin()).toBeNull();
  });

  it("rejects an extended expiry that keeps the original signature", async () => {
    const [exp, signature] = signAdminSession().split(".");
    memory.cookie = `${Number(exp) + 60 * 60 * 24 * 365}.${signature}`;

    expect(await currentAdmin()).toBeNull();
  });
});

describe("requireAdmin", () => {
  it("returns quietly for a signed-in editor", async () => {
    await addUser();
    const { token } = await startSession("usr_test");
    memory.cookie = token;

    await expect(requireAdmin()).resolves.toBeUndefined();
    expect(await isAdminRequest()).toBe(true);
  });

  it("redirects to the login page for anyone else", async () => {
    memory.cookie = newSessionToken();

    await expect(requireAdmin()).rejects.toThrow("REDIRECT /admin/login");
    expect(await isAdminRequest()).toBe(false);
  });
});

describe("requireAdminUser", () => {
  it("hands the identity to callers that need the role", async () => {
    await addUser();
    const { token } = await startSession("usr_test");
    memory.cookie = token;

    expect((await requireAdminUser()).role).toBe("editor");
  });

  it("redirects rather than returning null", async () => {
    await expect(requireAdminUser()).rejects.toThrow("REDIRECT /admin/login");
  });
});

describe("mayDeleteArticles", () => {
  const user = (role: string) => ({ ...ADMIN_PASSWORD_IDENTITY, role });

  it("is true for an admin and false for an editor", () => {
    expect(mayDeleteArticles(user("admin"))).toBe(true);
    expect(mayDeleteArticles(user("editor"))).toBe(false);
  });

  it("is false for anything else, including near misses", () => {
    for (const role of ["", "ADMIN", "admin ", "administrator", "superuser"]) {
      expect(mayDeleteArticles(user(role)), role).toBe(false);
    }
  });

  it("is true for the ADMIN_PASSWORD fallback, the only way into a fresh box", () => {
    expect(mayDeleteArticles(ADMIN_PASSWORD_IDENTITY)).toBe(true);
  });

  it("reads the role the session actually carries", async () => {
    await addUser(); // created as an editor
    const { token } = await startSession("usr_test");
    memory.cookie = token;

    const identity = await requireAdminUser();
    expect(identity.role).toBe("editor");
    expect(mayDeleteArticles(identity)).toBe(false);
  });
});

/**
 * The applications desk splits the same way the newsroom does, and for the
 * same reason: reading is open to both roles, and the one control with an
 * effect outside this site — pushing an applicant's record at the ERP — is not.
 */
describe("mayRetryApplications", () => {
  const user = (role: string) => ({ ...ADMIN_PASSWORD_IDENTITY, role });

  it("is true for an admin and false for an editor", () => {
    expect(mayRetryApplications(user("admin"))).toBe(true);
    expect(mayRetryApplications(user("editor"))).toBe(false);
  });

  it("is false for anything else, including near misses", () => {
    for (const role of ["", "ADMIN", "admin ", "administrator", "superuser"]) {
      expect(mayRetryApplications(user(role)), role).toBe(false);
    }
  });

  it("is true for the ADMIN_PASSWORD fallback, the only way into a fresh box", () => {
    expect(mayRetryApplications(ADMIN_PASSWORD_IDENTITY)).toBe(true);
  });

  it("lets an editor read the desk but not press retry", async () => {
    await addUser(); // created as an editor
    const { token } = await startSession("usr_test");
    memory.cookie = token;

    // The read gate is the same `requireAdmin()` every admin screen uses, and
    // it does not redirect an editor — the list is theirs to see.
    await expect(requireAdmin()).resolves.toBeUndefined();
    expect(mayRetryApplications(await requireAdminUser())).toBe(false);
  });

  it("redirects a caller with no session, before any role is considered", async () => {
    memory.cookie = null;
    await expect(requireAdmin()).rejects.toThrow("REDIRECT /admin/login");
  });
});
