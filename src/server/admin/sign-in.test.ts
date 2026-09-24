import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword } from "@/lib/auth/password";
import type { TestDatabase } from "@/lib/db/testing";

import {
  EMAIL_FREE_ATTEMPTS,
  MAX_IP_FAILURES,
  MAX_THROTTLE_MS,
  emailFailureCount,
  resetRateLimit,
  throttleDelayMs,
} from "./rate-limit";
import {
  SIGN_IN_FAILED,
  SIGN_IN_RATE_LIMITED,
  SIGN_IN_UNAVAILABLE,
  type SignInOutcome,
  signIn,
  signInAvailable,
} from "./sign-in";
import { loadSession, staffExists } from "./store";
import { hashSessionToken } from "./tokens";

/**
 * Every way in, and every way the door stays shut.
 *
 * The database is PGlite (Postgres in this process, built from the committed
 * migrations) and the argon2id hashing is the real one, so "the right password
 * is accepted" is a claim about the actual verifier and not about a stub.
 *
 * `./session` is stubbed — not to avoid the crypto, but because
 * `ADMIN_PASSWORD` is read once when that module loads, and the fallback needs
 * to be switched on and off case by case.
 *
 * Nothing here sleeps: `signIn` takes its `wait`, so a throttled answer is
 * recorded as a number of milliseconds instead of spent.
 */

const memory = vi.hoisted(() => ({ db: null as TestDatabase | null }));

vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");

  memory.db = await createTestDatabase();
  return { ...schema, getDb: () => memory.db!.db };
});

const legacy = vi.hoisted(() => ({ available: true, password: "the-old-shared-password" }));

vi.mock("./session", async () => {
  const actual = await vi.importActual<typeof import("./session")>("./session");
  return {
    ...actual,
    adminLoginAvailable: () => legacy.available,
    verifyAdminPassword: (input: string) => input === legacy.password,
  };
});

/** Counts the argon2 verifications, which is how the decoy is observed. */
const verifications = vi.hoisted(() => ({ hashes: [] as string[] }));

vi.mock("@/lib/auth/password", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/password")>(
    "@/lib/auth/password",
  );
  return {
    ...actual,
    verifyPassword: async (hashString: string, password: string) => {
      verifications.hashes.push(hashString);
      return actual.verifyPassword(hashString, password);
    },
  };
});

const NOW = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));
const EMAIL = "admin@shunkhlai.mn";
const PASSWORD = "correct-horse-battery-staple";
const IP = "10.0.0.5";

/** Hashed once: argon2id is deliberately slow, and every case wants the same one. */
let passwordHash = "";

/** Milliseconds `signIn` asked to be held back, per call. */
let waited: number[] = [];

async function addUser(
  overrides: Partial<{ id: string; email: string; isActive: boolean; role: string }> = {},
) {
  const schema = await import("@/lib/db/schema");
  await memory.db!.db.insert(schema.appUser).values({
    id: overrides.id ?? "usr_test",
    name: "Б. Энхжаргал",
    email: overrides.email ?? EMAIL,
    passwordHash,
    role: overrides.role ?? "admin",
    isActive: overrides.isActive ?? true,
    createdAt: NOW,
  });
}

/** The message of a refusal, and a loud failure if it was not one. */
function refusal(outcome: SignInOutcome): string {
  if (outcome.ok) throw new Error("expected a refusal, got a sign-in");
  return outcome.message;
}

function attempt(overrides: Partial<Parameters<typeof signIn>[0]> = {}) {
  return signIn({
    email: EMAIL,
    password: PASSWORD,
    // Null is the default in the app too: no trustworthy address unless a
    // reverse proxy is declared. Cases that are about the address pass one.
    ip: null,
    now: NOW,
    wait: async (ms: number) => {
      waited.push(ms);
    },
    ...overrides,
  });
}

/** The delay asked for on the final call, which must never have been a refusal. */
function refusalFreeDelay(): number {
  return waited.at(-1) ?? 0;
}

async function sessionCount(): Promise<number> {
  const schema = await import("@/lib/db/schema");
  return (await memory.db!.db.select().from(schema.adminSession)).length;
}

beforeAll(async () => {
  await staffExists(); // builds the mocked module (and its PGlite) once
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(async () => {
  await memory.db!.reset();
  resetRateLimit();
  legacy.available = true;
  verifications.hashes = [];
  waited = [];
});

describe("a real account", () => {
  it("signs in with the right password and opens a session", async () => {
    await addUser();
    const outcome = await attempt();

    expect(outcome).toMatchObject({
      ok: true,
      kind: "session",
      user: { id: "usr_test", email: EMAIL, role: "admin", source: "app_user" },
    });

    if (!outcome.ok || outcome.kind !== "session") throw new Error("expected a session");
    expect((await loadSession(outcome.token, NOW))?.user.id).toBe("usr_test");
  });

  it("accepts the address in any case, and with stray whitespace", async () => {
    await addUser();
    expect((await attempt({ email: "  Admin@Shunkhlai.MN  " })).ok).toBe(true);
  });

  it("hands back a token that is not what the database holds", async () => {
    await addUser();
    const outcome = await attempt();
    if (!outcome.ok || outcome.kind !== "session") throw new Error("expected a session");

    const schema = await import("@/lib/db/schema");
    const [row] = await memory.db!.db.select().from(schema.adminSession);

    expect(row.tokenHash).toBe(hashSessionToken(outcome.token));
    expect(row.tokenHash).not.toBe(outcome.token);
  });

  it("refuses the wrong password", async () => {
    await addUser();
    expect(await attempt({ password: "wrong" })).toEqual({
      ok: false,
      message: SIGN_IN_FAILED,
    });
  });

  it("refuses a near miss — a prefix, a trailing space, a case flip", async () => {
    await addUser();

    for (const password of [PASSWORD.slice(0, -1), `${PASSWORD} `, PASSWORD.toUpperCase()]) {
      expect((await attempt({ password })).ok, password).toBe(false);
      resetRateLimit();
    }
  });

  it("refuses an empty password AND counts it — it is not a free attempt", async () => {
    await addUser();

    expect(await attempt({ password: "" })).toEqual({ ok: false, message: SIGN_IN_FAILED });
    // The point of the early return is that it still costs an attempt. Without
    // this assertion the test passes with that whole branch deleted.
    expect(emailFailureCount(EMAIL, NOW.getTime())).toBe(1);
  });

  it("refuses an empty email and counts that too", async () => {
    await addUser();

    expect(await attempt({ email: "", password: "" })).toEqual({
      ok: false,
      message: SIGN_IN_FAILED,
    });
    expect(emailFailureCount("", NOW.getTime())).toBe(1);
  });

  it("writes no session row for a failed attempt", async () => {
    await addUser();
    await attempt({ password: "wrong" });

    expect(await sessionCount()).toBe(0);
  });
});

describe("the message never says which thing was wrong", () => {
  it("uses one sentence for an unknown email, a wrong password and a switched-off account", async () => {
    await addUser({ id: "usr_off", email: "off@shunkhlai.mn", isActive: false });
    await addUser();

    const unknown = await attempt({ email: "nobody@shunkhlai.mn" });
    resetRateLimit();
    const wrong = await attempt({ password: "wrong" });
    resetRateLimit();
    const inactive = await attempt({ email: "off@shunkhlai.mn" });

    expect(unknown).toEqual({ ok: false, message: SIGN_IN_FAILED });
    expect(wrong).toEqual({ ok: false, message: SIGN_IN_FAILED });
    expect(inactive).toEqual({ ok: false, message: SIGN_IN_FAILED });
  });

  it("refuses an inactive account even with the correct password", async () => {
    await addUser({ isActive: false });

    expect((await attempt()).ok).toBe(false);
    expect(await sessionCount()).toBe(0);
  });

  it("does not fall back to ADMIN_PASSWORD for an unknown email once accounts exist", async () => {
    await addUser();

    expect(
      await attempt({ email: "nobody@shunkhlai.mn", password: legacy.password }),
    ).toEqual({ ok: false, message: SIGN_IN_FAILED });
  });
});

describe("the timing oracle", () => {
  it("verifies against a decoy for an unknown address, so both cost the same", async () => {
    await addUser();

    await attempt({ email: "nobody@shunkhlai.mn" });

    // One real argon2 verification happened even though there was no account:
    // without it this branch returns in about a millisecond and a known
    // address takes about seventeen, which is a second failure message told
    // with a stopwatch.
    expect(verifications.hashes).toHaveLength(1);
    expect(verifications.hashes[0]).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/u);
  });

  it("does the same amount of work for a known address", async () => {
    await addUser();
    await attempt({ password: "wrong" });

    expect(verifications.hashes).toHaveLength(1);
    expect(verifications.hashes[0]).toBe(passwordHash);
  });

  it("does the same for a deactivated account", async () => {
    await addUser({ isActive: false });
    await attempt();

    expect(verifications.hashes).toHaveLength(1);
  });

  it("skips the decoy only where there is no account system yet", async () => {
    // The empty-table fallback is not comparable to anything: there are no
    // accounts, so there is nothing to learn about which addresses exist.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await attempt({ password: legacy.password });

    expect(verifications.hashes).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

describe("the exploits the reviewer demonstrated", () => {
  it("rotating the forwarded address no longer buys unlimited guesses", async () => {
    await addUser();

    // The old exploit: a fresh X-Forwarded-For per request meant a fresh
    // counter per request, so 100 wrong passwords went through untouched at
    // ~50 a second. Now the email brake does not care what the address says.
    for (let i = 0; i < 100; i += 1) {
      const outcome = await attempt({ password: `guess-${i}`, ip: `203.0.113.${i % 254}` });
      expect(refusal(outcome)).toBe(SIGN_IN_FAILED);
    }

    const throttled = waited.filter((ms) => ms > 0);
    expect(throttled.length).toBeGreaterThanOrEqual(100 - EMAIL_FREE_ATTEMPTS - 1);
    expect(waited.at(-1)).toBe(MAX_THROTTLE_MS);

    // Two seconds a try instead of twenty milliseconds: the run that took two
    // seconds now takes over three minutes, and goes on getting slower.
    const spent = waited.reduce((total, ms) => total + ms, 0);
    expect(spent).toBeGreaterThan(100_000);
  });

  it("a third party cannot lock a real admin out of their own account", async () => {
    await addUser();

    // The old exploit: spoof the victim's address, fail five times, and the
    // victim is refused from their own machine for fifteen minutes —
    // repeatable forever. Now: fail as many times as you like, against the
    // victim's email, from anywhere.
    for (let i = 0; i < 50; i += 1) {
      await attempt({ password: `guess-${i}`, ip: "203.0.113.9" });
    }

    expect(throttleDelayMs(EMAIL, NOW.getTime())).toBe(MAX_THROTTLE_MS);

    // The victim, with the right password, is let in. Slowed, never refused.
    const outcome = await attempt({ ip: "198.51.100.44" });
    expect(outcome.ok).toBe(true);
    expect(refusalFreeDelay()).toBeGreaterThan(0);
  });

  it("lets the admin in even from the very address that was flooding them", async () => {
    await addUser();
    // The attacker's own address IS locked out — but only because it really
    // is theirs. The victim's is not, and neither is their account.
    for (let i = 0; i < MAX_IP_FAILURES; i += 1) {
      await attempt({ password: `guess-${i}`, ip: "203.0.113.9" });
    }

    expect(refusal(await attempt({ ip: "203.0.113.9" }))).toBe(SIGN_IN_RATE_LIMITED);
    expect((await attempt({ ip: "198.51.100.44" })).ok).toBe(true);
  });
});

describe("the address brake", () => {
  it("refuses an address outright once it has failed enough times", async () => {
    await addUser();

    for (let i = 0; i < MAX_IP_FAILURES; i += 1) {
      // Spread across accounts, which is the spraying this half is for.
      await attempt({ email: `nobody-${i}@shunkhlai.mn`, password: "wrong", ip: IP });
    }

    expect(refusal(await attempt({ ip: IP }))).toBe(SIGN_IN_RATE_LIMITED);
  });

  it("is disarmed when there is no trustworthy address", async () => {
    await addUser();

    // `ip: null` is the default. Failing a hundred times must not produce a
    // refusal, because the only thing that could key one is a header anyone
    // can write.
    for (let i = 0; i < MAX_IP_FAILURES * 3; i += 1) {
      await attempt({ email: `nobody-${i}@shunkhlai.mn`, password: "wrong" });
    }

    expect((await attempt()).ok).toBe(true);
  });

  it("does not refuse a different address", async () => {
    await addUser();
    for (let i = 0; i < MAX_IP_FAILURES; i += 1) {
      await attempt({ email: `nobody-${i}@shunkhlai.mn`, password: "wrong", ip: IP });
    }

    expect((await attempt({ ip: "198.51.100.1" })).ok).toBe(true);
  });

  it("is forgiven after a successful sign-in from that address", async () => {
    await addUser();
    for (let i = 0; i < MAX_IP_FAILURES - 1; i += 1) {
      await attempt({ email: `nobody-${i}@shunkhlai.mn`, password: "wrong", ip: IP });
    }

    expect((await attempt({ ip: IP })).ok).toBe(true);

    for (let i = 0; i < MAX_IP_FAILURES - 1; i += 1) {
      const outcome = await attempt({ email: `x-${i}@shunkhlai.mn`, password: "wrong", ip: IP });
      expect(refusal(outcome)).toBe(SIGN_IN_FAILED);
    }
  });
});

describe("the empty-table fallback", () => {
  it("accepts ADMIN_PASSWORD when app_user has no rows at all", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await attempt({ password: legacy.password })).toEqual({
      ok: true,
      kind: "admin-password",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ADMIN_PASSWORD"));
    warn.mockRestore();
  });

  it("opens no session row — there is no user to point one at", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await attempt({ password: legacy.password });

    expect(await sessionCount()).toBe(0);
    vi.restoreAllMocks();
  });

  it("still refuses the wrong shared password", async () => {
    expect(await attempt({ password: "not-the-old-password" })).toEqual({
      ok: false,
      message: SIGN_IN_FAILED,
    });
  });

  it("closes the moment one staff account exists", async () => {
    await addUser();

    expect(await attempt({ password: legacy.password })).toEqual({
      ok: false,
      message: SIGN_IN_FAILED,
    });
  });

  it("says so, rather than refusing, when there is no way in at all", async () => {
    legacy.available = false;

    expect(await attempt()).toEqual({ ok: false, message: SIGN_IN_UNAVAILABLE });
  });
});

describe("signInAvailable", () => {
  it("is true while ADMIN_PASSWORD is set, even with no accounts", async () => {
    expect(await signInAvailable()).toBe(true);
  });

  it("is true once an account exists, whatever ADMIN_PASSWORD is", async () => {
    legacy.available = false;
    await addUser();
    expect(await signInAvailable()).toBe(true);
  });

  it("is false with neither", async () => {
    legacy.available = false;
    expect(await signInAvailable()).toBe(false);
  });
});
