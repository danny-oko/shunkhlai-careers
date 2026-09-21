import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// In-memory stand-in for the applicant_link row, with a drizzle-shaped surface.
const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
  login: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));
vi.mock("@/lib/db", () => ({
  applicantLink: {},
  applicantProfile: {},
  getDb: () => ({
    select: () => ({ from: () => ({ where: async () => (state.row ? [state.row] : []) }) }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updates.push(values);
          state.row = { ...state.row, ...values };
        },
      }),
    }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: async () => {} }) }),
  }),
}));
// Fake crypto: "enc(x)" <-> "x"; anything else is unreadable (mimics a wrong key).
vi.mock("@/lib/db/crypto", () => {
  return {
    encryptSecret: async (v: string) => `enc(${v})`,
    decryptSecret: async (v: string) => {
      if (v === "config-fault") throw new Error("APP_ENCRYPTION_KEY is not set");
      const m = /^enc\((.*)\)$/.exec(v);
      if (!m) throw new DOMException("Cipher job failed", "OperationError");
      return m[1];
    },
  };
});
vi.mock("./client", () => ({
  ErpError: class extends Error {},
  erpLogin: state.login,
  erpPost: vi.fn(),
  erpGet: vi.fn(),
}));

import { ErpCredentialsUnreadableError, getValidErpToken } from "./link";

const HOUR = 3_600_000;
const fresh = { accessToken: "tok2", refreshToken: null, expiresAt: Date.now() + HOUR, appId: "a1" };

function baseRow(over: Record<string, unknown> = {}) {
  return {
    clerkUserId: "u1",
    regnoEnc: "enc(AA00000000)",
    phoneEnc: "enc(99119911)",
    erpAccessTokenEnc: "enc(tok1)",
    erpRefreshTokenEnc: null,
    erpAppId: "a1",
    erpTokenExpiresAt: new Date(Date.now() + HOUR),
    status: "linked",
    lastError: null,
    ...over,
  };
}

function expectMarkedFailed() {
  const failed = state.updates.find((u) => u.status === "failed");
  expect(failed).toBeDefined();
  expect(failed!.lastError).toBe("credentials_unreadable");
  expect(failed!.erpAccessTokenEnc ?? null).toBeNull();
  expect(state.row!.status).toBe("failed");
  expect(state.row!.erpAccessTokenEnc ?? null).toBeNull();
}

beforeEach(() => {
  vi.clearAllMocks();
  state.updates = [];
  state.row = baseRow();
});

describe("getValidErpToken — happy paths unchanged", () => {
  it("returns the stored token when unexpired, without re-login", async () => {
    await expect(getValidErpToken("u1")).resolves.toBe("tok1");
    expect(state.login).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
  });

  it("re-logs in when expired and persists the re-encrypted token", async () => {
    state.row = baseRow({ erpTokenExpiresAt: new Date(Date.now() - 1000) });
    state.login.mockResolvedValue(fresh);
    await expect(getValidErpToken("u1")).resolves.toBe("tok2");
    expect(state.login).toHaveBeenCalledWith("AA00000000", "99119911");
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ erpAccessTokenEnc: "enc(tok2)", status: "linked" });
  });

  it("throws when there is no link row", async () => {
    state.row = null;
    await expect(getValidErpToken("u1")).rejects.toThrow();
    expect(state.updates).toEqual([]);
  });
});

describe("getValidErpToken — unreadable credentials self-heal", () => {
  it("unreadable stored access token → marks failed and throws ErpCredentialsUnreadableError", async () => {
    state.row = baseRow({ erpAccessTokenEnc: "garbage-from-old-key" });
    const err = await getValidErpToken("u1").catch((e) => e);
    expect(err).toBeInstanceOf(ErpCredentialsUnreadableError);
    expect(err).toBeInstanceOf(Error);
    expect(state.login).not.toHaveBeenCalled();
    expectMarkedFailed();
  });

  it("expired token + unreadable regno → marks failed, never calls erpLogin", async () => {
    state.row = baseRow({ erpTokenExpiresAt: new Date(Date.now() - 1000), regnoEnc: "garbage" });
    const err = await getValidErpToken("u1").catch((e) => e);
    expect(err).toBeInstanceOf(ErpCredentialsUnreadableError);
    expect(state.login).not.toHaveBeenCalled();
    expectMarkedFailed();
  });

  it("expired token + unreadable phone → marks failed, never calls erpLogin", async () => {
    state.row = baseRow({ erpTokenExpiresAt: new Date(Date.now() - 1000), phoneEnc: "garbage" });
    const err = await getValidErpToken("u1").catch((e) => e);
    expect(err).toBeInstanceOf(ErpCredentialsUnreadableError);
    expect(state.login).not.toHaveBeenCalled();
    expectMarkedFailed();
  });
});

describe("getValidErpToken — erpLogin failures propagate untouched", () => {
  it("ERP down: rethrows the same error and does NOT mark the row failed", async () => {
    state.row = baseRow({ erpTokenExpiresAt: new Date(Date.now() - 1000) });
    const boom = new Error("ERP unreachable");
    state.login.mockRejectedValue(boom);
    const err = await getValidErpToken("u1").catch((e) => e);
    expect(err).toBe(boom);
    expect(err).not.toBeInstanceOf(ErpCredentialsUnreadableError);
    expect(state.updates.some((u) => u.status === "failed")).toBe(false);
    expect(state.row!.status).toBe("linked");
  });

  it("config fault (key missing) is rethrown as-is and does NOT flag the link", async () => {
    state.row = baseRow({ erpAccessTokenEnc: "config-fault" });
    await expect(getValidErpToken("u1")).rejects.toThrow("APP_ENCRYPTION_KEY is not set");
    expect(state.updates.some((u) => u.status === "failed")).toBe(false);
  });

  it("bad creds from ERP: rethrows and keeps the link", async () => {
    state.row = baseRow({ erpTokenExpiresAt: null, erpAccessTokenEnc: null });
    const bad = new Error("Нууц үг буруу");
    state.login.mockRejectedValue(bad);
    await expect(getValidErpToken("u1")).rejects.toBe(bad);
    expect(state.updates.some((u) => u.status === "failed")).toBe(false);
  });
});

describe("adversarial: REAL AES-GCM, row encrypted under a different key", () => {
  const origKey = process.env.APP_ENCRYPTION_KEY;
  const keyA = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
  const keyB = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");

  beforeEach(() => {
    // Use the REAL AES-GCM module for this block; the login mock must never be reached.
    vi.doUnmock("@/lib/db/crypto");
    state.login.mockReset();
    state.login.mockResolvedValue(fresh);
  });

  afterAll(() => {
    if (origKey === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = origKey;
    vi.resetModules();
  });

  async function encryptUnderKeyA() {
    process.env.APP_ENCRYPTION_KEY = keyA;
    vi.resetModules();
    const c = await import("@/lib/db/crypto");
    const probe = await c.encryptSecret("x");
    expect(probe).not.toMatch(/^enc\(/); // sanity: this is the real module, not the fake
    expect(await c.decryptSecret(probe)).toBe("x");
    return {
      regnoEnc: await c.encryptSecret("AA00000000"),
      phoneEnc: await c.encryptSecret("99119911"),
      erpAccessTokenEnc: await c.encryptSecret("tok1"),
    };
  }

  async function loadUnderKeyB() {
    process.env.APP_ENCRYPTION_KEY = keyB;
    vi.resetModules();
    const c = await import("@/lib/db/crypto");
    const link = await import("./link");
    return { c, link };
  }

  it("raw decrypt with key B throws (baseline for the prod bug)", async () => {
    const enc = await encryptUnderKeyA();
    const { c } = await loadUnderKeyB();
    await expect(c.decryptSecret(enc.erpAccessTokenEnc)).rejects.toThrow();
  });

  it("unexpired token under key A, read with key B → ErpCredentialsUnreadableError, not OperationError", async () => {
    const enc = await encryptUnderKeyA();
    state.row = baseRow(enc);
    const { link } = await loadUnderKeyB();
    const err = await link.getValidErpToken("u1").catch((e) => e);
    expect(err).toBeInstanceOf(link.ErpCredentialsUnreadableError);
    expect((err as Error).name).not.toBe("OperationError");
    expect(state.login).not.toHaveBeenCalled();
    expectMarkedFailed();
  });

  it("expired token, creds under key A, read with key B → ErpCredentialsUnreadableError", async () => {
    const enc = await encryptUnderKeyA();
    state.row = baseRow({ ...enc, erpTokenExpiresAt: new Date(Date.now() - 1000) });
    const { link } = await loadUnderKeyB();
    const err = await link.getValidErpToken("u1").catch((e) => e);
    expect(err).toBeInstanceOf(link.ErpCredentialsUnreadableError);
    expect(state.login).not.toHaveBeenCalled();
    expectMarkedFailed();
  });
});
