import { afterEach, describe, expect, it, vi } from "vitest";

type Session = typeof import("./session");

async function load(env: Record<string, string | undefined>): Promise<Session> {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  return import("./session");
}

const PASSWORD = "correct-horse-battery-staple";
const SECRET = "test-session-secret";

const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("verifyAdminPassword", () => {
  it("accepts the configured password", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    expect(session.verifyAdminPassword(PASSWORD)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    expect(session.verifyAdminPassword("wrong")).toBe(false);
  });

  it("rejects near-misses, including a prefix and a case flip", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });

    expect(session.verifyAdminPassword(PASSWORD.slice(0, -1))).toBe(false);
    expect(session.verifyAdminPassword(`${PASSWORD} `)).toBe(false);
    expect(session.verifyAdminPassword(PASSWORD.toUpperCase())).toBe(false);
  });

  it("rejects an empty string without throwing on the length mismatch", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });

    expect(() => session.verifyAdminPassword("")).not.toThrow();
    expect(session.verifyAdminPassword("")).toBe(false);
  });

  it("falls back to the dev password under `next dev`", async () => {
    const session = await load({
      NODE_ENV: "development",
      ADMIN_PASSWORD: undefined,
      ADMIN_SESSION_SECRET: undefined,
    });

    expect(session.adminLoginAvailable()).toBe(true);
    expect(session.verifyAdminPassword("shunkhlai-dev")).toBe(true);
    expect(session.verifyAdminPassword("shunkhlai-prod")).toBe(false);
  });

  it("does NOT fall back in an environment that is merely not production", async () => {
    // `next start` under a service manager that never set NODE_ENV, a staging
    // box calling itself "staging", a test runner: none of these are `next
    // dev`, and with `app_user` empty this constant would open everything.
    for (const nodeEnv of ["test", "staging", undefined]) {
      const session = await load({
        NODE_ENV: nodeEnv,
        ADMIN_PASSWORD: undefined,
        ADMIN_SESSION_SECRET: undefined,
      });

      expect(session.adminLoginAvailable(), String(nodeEnv)).toBe(false);
      expect(session.verifyAdminPassword("shunkhlai-dev"), String(nodeEnv)).toBe(false);
    }
  });

  it("fails closed in production with no password configured", async () => {
    const session = await load({
      NODE_ENV: "production",
      ADMIN_PASSWORD: undefined,
      ADMIN_SESSION_SECRET: undefined,
    });

    expect(session.adminLoginAvailable()).toBe(false);
    // Critically, the dev fallback must not be reachable here.
    expect(session.verifyAdminPassword("shunkhlai-dev")).toBe(false);
    expect(session.verifyAdminPassword("")).toBe(false);
    expect(session.verifyAdminSession(session.signAdminSession(NOW), NOW)).toBe(
      false,
    );
  });
});

describe("signAdminSession / verifyAdminSession", () => {
  it("round-trips a freshly signed token", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    const token = session.signAdminSession(NOW);

    expect(session.verifyAdminSession(token, NOW)).toBe(true);
  });

  it("stamps the expiry as `<epochSeconds>.<signature>`", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    const [exp, signature, ...rest] = session.signAdminSession(NOW).split(".");

    expect(rest).toHaveLength(0);
    expect(Number(exp)).toBe(
      Math.floor(NOW / 1000) + session.SESSION_TTL_SECONDS,
    );
    expect(signature).toMatch(/^[\w-]+$/u);
    // base64url: no padding, no +/ that would need escaping in a cookie.
    expect(signature).not.toContain("=");
    expect(signature).not.toContain("+");
    expect(signature).not.toContain("/");
  });

  it("still accepts the token one second before it expires", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    const token = session.signAdminSession(NOW);
    const justBefore = NOW + (session.SESSION_TTL_SECONDS - 1) * 1000;

    expect(session.verifyAdminSession(token, justBefore)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    const token = session.signAdminSession(NOW);
    const afterExpiry = NOW + (session.SESSION_TTL_SECONDS + 60) * 1000;

    expect(session.verifyAdminSession(token, afterExpiry)).toBe(false);
  });

  it("rejects a tampered HMAC", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    const [exp, signature] = session.signAdminSession(NOW).split(".");

    // Flip one character of the signature, keeping the length identical so the
    // comparison is the thing under test rather than the length guard.
    const first = signature.charAt(0);
    const flipped = (first === "A" ? "B" : "A") + signature.slice(1);

    expect(flipped).not.toBe(signature);
    expect(session.verifyAdminSession(`${exp}.${flipped}`, NOW)).toBe(false);
  });

  it("rejects an extended expiry that keeps the original signature", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    const [exp, signature] = session.signAdminSession(NOW).split(".");
    const forged = `${Number(exp) + 60 * 60 * 24 * 365}.${signature}`;

    expect(session.verifyAdminSession(forged, NOW)).toBe(false);
  });

  it("rejects a signature of the wrong length instead of throwing", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    const [exp, signature] = session.signAdminSession(NOW).split(".");

    for (const bad of [signature.slice(0, 8), `${signature}AAAA`, ""]) {
      const value = `${exp}.${bad}`;
      expect(() => session.verifyAdminSession(value, NOW)).not.toThrow();
      expect(session.verifyAdminSession(value, NOW)).toBe(false);
    }
  });

  it("rejects garbage, empty, null and undefined values", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });

    const values: Array<string | null | undefined> = [
      null,
      undefined,
      "",
      "   ",
      ".",
      "..",
      "abc",
      "abc.def",
      "9999999999",
      "9999999999.",
      ".signature",
      "NaN.signature",
      "1e400.signature",
      "-1.signature",
      "0x10.signature",
      " 9999999999.signature",
      "9999999999.signature.extra",
      "{}",
      "[object Object]",
    ];

    for (const value of values) {
      expect(
        () => session.verifyAdminSession(value, NOW),
        String(value),
      ).not.toThrow();
      expect(session.verifyAdminSession(value, NOW), String(value)).toBe(false);
    }
  });

  it("rejects a token signed under a different password", async () => {
    // No explicit secret, so it derives from the password: changing the
    // password must invalidate every cookie already in the wild.
    const before = await load({
      ADMIN_PASSWORD: "old-password",
      ADMIN_SESSION_SECRET: undefined,
    });
    const token = before.signAdminSession(NOW);
    expect(before.verifyAdminSession(token, NOW)).toBe(true);

    const after = await load({
      ADMIN_PASSWORD: "new-password",
      ADMIN_SESSION_SECRET: undefined,
    });
    expect(after.verifyAdminSession(token, NOW)).toBe(false);
  });

  it("rejects a token signed under a different explicit secret", async () => {
    const before = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: "secret-a",
    });
    const token = before.signAdminSession(NOW);

    const after = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: "secret-b",
    });
    expect(after.verifyAdminSession(token, NOW)).toBe(false);
  });

  it("keeps a token valid across a restart when the password is unchanged", async () => {
    const before = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: undefined,
    });
    const token = before.signAdminSession(NOW);

    const after = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: undefined,
    });
    expect(after.verifyAdminSession(token, NOW)).toBe(true);
  });

  it("defaults `nowMs` to the current clock", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });

    expect(session.verifyAdminSession(session.signAdminSession())).toBe(true);
  });
});

describe("adminCookieOptions", () => {
  it("scopes the cookie to /admin so it never rides along on public pages", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    const options = session.adminCookieOptions();

    expect(session.ADMIN_COOKIE).toBe("shunkhlai.admin");
    expect(options.httpOnly).toBe(true); expect(options.sameSite).toBe("lax"); expect(options.path).toBe("/admin"); expect(options.maxAge).toBe(session.SESSION_TTL_SECONDS); });
  it("is insecure only outside production", async () => {
    const dev = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    expect(dev.adminCookieOptions().secure).toBe(false);

    const prod = await load({
      NODE_ENV: "production",
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    expect(prod.adminCookieOptions().secure).toBe(true);
  });

  it("keeps the TTL at eight hours", async () => {
    const session = await load({
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_SESSION_SECRET: SECRET,
    });
    expect(session.SESSION_TTL_SECONDS).toBe(60 * 60 * 8);
  });
});
