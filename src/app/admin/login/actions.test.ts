import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { TestDatabase } from "@/lib/db/testing";
import { EMAIL_FREE_ATTEMPTS, MAX_IP_FAILURES, resetRateLimit } from "@/server/admin/rate-limit";
import { SIGN_IN_FAILED, SIGN_IN_RATE_LIMITED } from "@/server/admin/sign-in";
import { findStaffById, loadSession, staffExists, startSession } from "@/server/admin/store";
import { looksLikeSessionToken } from "@/server/admin/tokens";

import { changePasswordAction, loginAction, logoutAction } from "./actions";

/**
 * The three actions, at the layer the browser actually reaches: a `FormData`
 * in, a cookie and a redirect out.
 *
 * The decision itself is `sign-in.test.ts`'s subject; what is tested here is
 * the wiring that only a server action does — that the cookie carries the
 * token and not something else, that logging out deletes the row before it
 * clears the cookie, and that a password change invalidates the sessions the
 * old password could have been used to open.
 */

vi.hoisted(() => {
  process.env.ADMIN_PASSWORD = "the-old-shared-password";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
});

const memory = vi.hoisted(() => ({
  db: null as TestDatabase | null,
  cookie: null as string | null,
  /** Every `cookies().set()` this action made, in order. */
  writes: [] as Array<{ value: string; maxAge: number }>,
  /** The request headers this action will see. */
  headers: new Map<string, string>(),
  /** A statement matching this throws, to cut a transaction in half. */
  failOn: null as RegExp | null,
  /** Milliseconds the throttle asked to be held back, per call. */
  waited: [] as number[],
}));

vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");

  memory.db = await createTestDatabase({
    onQuery: (sql) => {
      if (memory.failOn?.test(sql)) throw new Error("database unavailable");
    },
  });
  return { ...schema, getDb: () => memory.db!.db };
});

/**
 * The real counters, with only the sleep replaced — a throttled password
 * change would otherwise really hold this test file up for two seconds.
 */
vi.mock("@/server/admin/rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/admin/rate-limit")>("@/server/admin/rate-limit");
  return {
    ...actual,
    wait: async (ms: number) => {
      memory.waited.push(ms);
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      memory.cookie === null ? undefined : { name, value: memory.cookie },
    set: (_name: string, value: string, options: { maxAge: number }) => {
      memory.writes.push({ value, maxAge: options.maxAge });
      memory.cookie = value === "" ? null : value;
    },
  }),
  headers: async () => memory.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const EMAIL = "admin@shunkhlai.mn";
const PASSWORD = "correct-horse-battery-staple";
const NEW_PASSWORD = "an-entirely-different-one";

let passwordHash = "";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

async function addUser(isActive = true) {
  const schema = await import("@/lib/db/schema");
  await memory.db!.db.insert(schema.appUser).values({
    id: "usr_test",
    name: "Б. Энхжаргал",
    email: EMAIL,
    passwordHash,
    role: "admin",
    isActive,
    createdAt: new Date(),
  });
}

/** Signs in for real and leaves the cookie where the next action will find it. */
async function signedIn(): Promise<string> {
  const { token } = await startSession("usr_test");
  memory.cookie = token;
  return token;
}

beforeAll(async () => {
  await staffExists();
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(async () => {
  await memory.db!.reset();
  resetRateLimit();
  memory.cookie = null;
  memory.writes = [];
  memory.headers = new Map();
  memory.failOn = null;
  memory.waited = [];
  vi.unstubAllEnvs();
});

describe("loginAction", () => {
  it("sets the session token as the cookie and redirects to the desk", async () => {
    await addUser();

    await expect(
      loginAction({}, form({ email: EMAIL, password: PASSWORD })),
    ).rejects.toThrow("REDIRECT /admin/news");

    expect(memory.writes).toHaveLength(1);
    const [written] = memory.writes;
    expect(looksLikeSessionToken(written.value)).toBe(true);
    expect((await loadSession(written.value))?.user.id).toBe("usr_test");
  });

  it("honours a `next` under /admin and ignores anywhere else", async () => {
    await addUser();

    await expect(
      loginAction({}, form({ email: EMAIL, password: PASSWORD, next: "/admin/news/new" })),
    ).rejects.toThrow("REDIRECT /admin/news/new");

    memory.cookie = null;
    await expect(
      loginAction({}, form({ email: EMAIL, password: PASSWORD, next: "https://evil.example" })),
    ).rejects.toThrow("REDIRECT /admin/news");
  });

  it("returns the failure message and sets no cookie on a bad password", async () => {
    await addUser();

    expect(await loginAction({}, form({ email: EMAIL, password: "wrong" }))).toEqual({
      error: SIGN_IN_FAILED,
    });
    expect(memory.writes).toHaveLength(0);
  });

  it("sets the legacy stamp — not a token — on the empty-table fallback", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      loginAction({}, form({ email: EMAIL, password: "the-old-shared-password" })),
    ).rejects.toThrow("REDIRECT /admin/news");

    const [written] = memory.writes;
    expect(looksLikeSessionToken(written.value)).toBe(false);
    expect(written.value).toMatch(/^\d+\.[\w-]+$/u);
    vi.restoreAllMocks();
  });
});

describe("logoutAction", () => {
  it("deletes the session row and expires the cookie", async () => {
    await addUser();
    const token = await signedIn();

    await expect(logoutAction()).rejects.toThrow("REDIRECT /admin/login");

    expect(await loadSession(token)).toBeNull();
    expect(memory.writes.at(-1)).toEqual({ value: "", maxAge: 0 });
  });

  it("clears the cookie for a legacy stamp too, with no row to delete", async () => {
    memory.cookie = "1790000000.notatoken";

    await expect(logoutAction()).rejects.toThrow("REDIRECT /admin/login");
    expect(memory.writes.at(-1)?.maxAge).toBe(0);
  });
});

describe("changePasswordAction", () => {
  it("stores a new hash the new password verifies against", async () => {
    await addUser();
    await signedIn();

    expect(
      await changePasswordAction(
        {},
        form({ current: PASSWORD, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
      ),
    ).toEqual({ ok: true });

    const user = await findStaffById("usr_test");
    expect(await verifyPassword(user!.passwordHash, NEW_PASSWORD)).toBe(true);
    expect(await verifyPassword(user!.passwordHash, PASSWORD)).toBe(false);
  });

  it("ends every other session and leaves this browser signed in", async () => {
    await addUser();
    const elsewhere = (await startSession("usr_test")).token;
    await signedIn();

    await changePasswordAction(
      {},
      form({ current: PASSWORD, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
    );

    // Whoever knew the old password is out, including on another machine.
    expect(await loadSession(elsewhere)).toBeNull();
    // And the person who just changed it is not signed out of their own tab.
    const fresh = memory.writes.at(-1)!.value;
    expect((await loadSession(fresh))?.user.id).toBe("usr_test");
  });

  it("refuses a wrong current password and changes nothing", async () => {
    await addUser();
    await signedIn();

    const state = await changePasswordAction(
      {},
      form({ current: "wrong", next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
    );

    expect(state.ok).toBeUndefined();
    expect(state.error).toBeTruthy();
    const user = await findStaffById("usr_test");
    expect(await verifyPassword(user!.passwordHash, PASSWORD)).toBe(true);
  });

  it("refuses when the two new passwords differ", async () => {
    await addUser();
    await signedIn();

    const state = await changePasswordAction(
      {},
      form({ current: PASSWORD, next: NEW_PASSWORD, repeat: `${NEW_PASSWORD}x` }),
    );

    expect(state.ok).toBeUndefined();
    expect(state.error).toContain("таарахгүй");
  });

  it("refuses a new password shorter than the minimum", async () => {
    await addUser();
    await signedIn();

    const state = await changePasswordAction(
      {},
      form({ current: PASSWORD, next: "short", repeat: "short" }),
    );

    expect(state.ok).toBeUndefined();
    expect(state.error).toContain("12");
  });

  it("refuses when nobody is signed in", async () => {
    await addUser();

    const state = await changePasswordAction(
      {},
      form({ current: PASSWORD, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
    );

    expect(state.error).toBeTruthy();
    expect(state.ok).toBeUndefined();
  });

  it("refuses for the ADMIN_PASSWORD fallback, which has no row to change", async () => {
    const { signAdminSession } = await import("@/server/admin/session");
    memory.cookie = signAdminSession();

    const state = await changePasswordAction(
      {},
      form({ current: PASSWORD, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
    );

    expect(state.error).toContain("ADMIN_PASSWORD");
  });
});

describe("clientIp — which address, and whether to believe it", () => {
  /** Fails `count` times with a wrong password, through the login form. */
  async function failTimes(count: number, email = EMAIL) {
    for (let i = 0; i < count; i += 1) {
      await loginAction({}, form({ email, password: `guess-${i}` }));
    }
  }

  it("ignores forwarded headers unless a proxy is declared", async () => {
    await addUser();
    memory.headers = new Map([["x-forwarded-for", "203.0.113.1"]]);

    // Far past the address limit, from what claims to be one address. With no
    // TRUST_PROXY_HEADERS there is no trustworthy address, so the per-address
    // refusal is disarmed and the right password still works.
    await failTimes(MAX_IP_FAILURES + 2);

    await expect(
      loginAction({}, form({ email: EMAIL, password: PASSWORD })),
    ).rejects.toThrow("REDIRECT /admin/news");
  });

  it("uses the address when a proxy is declared, and then refuses it", async () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    await addUser();
    memory.headers = new Map([["x-forwarded-for", "203.0.113.1"]]);

    await failTimes(MAX_IP_FAILURES);

    expect(await loginAction({}, form({ email: EMAIL, password: PASSWORD }))).toEqual({
      error: SIGN_IN_RATE_LIMITED,
    });
  });

  it("takes the LAST hop, not the first — the first is the client's own", async () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    await addUser();

    // nginx appends its view to whatever arrived, so the client controls the
    // left of this list and our proxy wrote the right of it.
    memory.headers = new Map([["x-forwarded-for", "1.1.1.1, 198.51.100.7"]]);
    await failTimes(MAX_IP_FAILURES);

    // A different invented first hop, same real one: still the same counter.
    memory.headers = new Map([["x-forwarded-for", "2.2.2.2, 198.51.100.7"]]);
    expect(await loginAction({}, form({ email: EMAIL, password: PASSWORD }))).toEqual({
      error: SIGN_IN_RATE_LIMITED,
    });

    // A genuinely different last hop is a genuinely different visitor.
    memory.headers = new Map([["x-forwarded-for", "1.1.1.1, 198.51.100.8"]]);
    await expect(
      loginAction({}, form({ email: EMAIL, password: PASSWORD })),
    ).rejects.toThrow("REDIRECT /admin/news");
  });

  it("falls back to x-real-ip when there is no forwarded list", async () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    await addUser();
    memory.headers = new Map([["x-real-ip", "198.51.100.9"]]);

    await failTimes(MAX_IP_FAILURES);

    expect(await loginAction({}, form({ email: EMAIL, password: PASSWORD }))).toEqual({
      error: SIGN_IN_RATE_LIMITED,
    });
  });

  it("never lets a flood against one admin refuse that admin", async () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    await addUser();

    // The attacker, hammering the victim's email from their own address.
    memory.headers = new Map([["x-forwarded-for", "203.0.113.66"]]);
    await failTimes(MAX_IP_FAILURES * 2);

    // The victim, at their desk, with the right password.
    memory.headers = new Map([["x-forwarded-for", "10.0.0.5"]]);
    await expect(
      loginAction({}, form({ email: EMAIL, password: PASSWORD })),
    ).rejects.toThrow("REDIRECT /admin/news");
  });
});

describe("changePasswordAction — the throttle and the transaction", () => {
  it("slows repeated wrong guesses at the current password", async () => {
    await addUser();
    await signedIn();

    for (let i = 0; i < EMAIL_FREE_ATTEMPTS + 3; i += 1) {
      await changePasswordAction(
        {},
        form({ current: `guess-${i}`, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
      );
    }

    // A hijacked idle session could otherwise grind the real password here at
    // one try per argon2 verification, entirely outside the login page.
    expect(memory.waited.filter((ms) => ms > 0).length).toBeGreaterThan(0);
    expect(memory.waited.at(-1)).toBeGreaterThan(0);
  });

  it("forgets the delay once the right current password is given", async () => {
    await addUser();
    await signedIn();

    for (let i = 0; i < EMAIL_FREE_ATTEMPTS + 2; i += 1) {
      await changePasswordAction(
        {},
        form({ current: `guess-${i}`, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
      );
    }

    expect(
      await changePasswordAction(
        {},
        form({ current: PASSWORD, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
      ),
    ).toEqual({ ok: true });

    memory.waited = [];
    // The counter was cleared, so the next sign-in is not still being slowed.
    await loginAction({}, form({ email: EMAIL, password: "wrong" }));
    expect(memory.waited.filter((ms) => ms > 0)).toEqual([]);
  });

  it("changes nothing at all when a statement fails part-way through", async () => {
    await addUser();
    const elsewhere = (await startSession("usr_test")).token;
    await signedIn();

    // The new session's INSERT is the last of the three writes. Without a
    // transaction the delete and the update would already have landed, which
    // is the state the reviewer named: old sessions gone or — worse, in the
    // other order — still valid against a password that has changed.
    memory.failOn = /insert into "admin_session"/iu;

    await expect(
      changePasswordAction(
        {},
        form({ current: PASSWORD, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
      ),
    ).rejects.toThrow();

    memory.failOn = null;

    // The password did not move.
    const user = await findStaffById("usr_test");
    expect(await verifyPassword(user!.passwordHash, PASSWORD)).toBe(true);
    expect(await verifyPassword(user!.passwordHash, NEW_PASSWORD)).toBe(false);
    // And the other session is exactly as it was.
    expect((await loadSession(elsewhere))?.user.id).toBe("usr_test");
  });

  it("turns an account switched off mid-session away before it writes anything", async () => {
    const schema = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await addUser();
    await signedIn();

    await memory
      .db!.db.update(schema.appUser)
      .set({ isActive: false })
      .where(eq(schema.appUser.id, "usr_test"));

    // Deactivating ends the session (see `loadSession`), so this never even
    // reaches the password check — it is simply somebody who is not signed in.
    // The transaction's own `is_active` guard is the backstop underneath, and
    // is tested in `store.test.ts`.
    const state = await changePasswordAction(
      {},
      form({ current: PASSWORD, next: NEW_PASSWORD, repeat: NEW_PASSWORD }),
    );

    expect(state.ok).toBeUndefined();
    expect(state.error).toBeTruthy();

    const user = await findStaffById("usr_test");
    expect(await verifyPassword(user!.passwordHash, PASSWORD)).toBe(true);
  });
});
