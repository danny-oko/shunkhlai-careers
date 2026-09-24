import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminIdentity } from "@/server/admin/store";

/**
 * The desk's one write, and who is allowed to press it.
 *
 * `mayRetryApplications` is the real function — only `requireAdminUser` is
 * replaced, so what is under test is the action's own decision rather than a
 * mock of the rule. Everything with a side effect is a spy: nothing here
 * reaches a database, and nothing reaches the ERP.
 */

const memory = vi.hoisted(() => ({
  /** Who is signed in; null redirects, as the real gate does. */
  user: null as AdminIdentity | null,
  resolved: null as { email: string; entryid: number } | null,
  retried: [] as Array<{ email: string; entryid: number }>,
  retryResult: { ok: true } as { ok: boolean; reason?: "not_found" | "conflict" },
  retryThrows: false,
  revalidated: [] as string[],
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => memory.revalidated.push(path),
}));

vi.mock("@/server/admin/guard", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/admin/guard")>("@/server/admin/guard");
  return {
    ...actual,
    requireAdminUser: async () => {
      if (!memory.user) throw new Error("REDIRECT /admin/login");
      return memory.user;
    },
  };
});

// `@/server/admin/guard`'s real module reaches for these; nothing under test
// calls them, and a stub keeps the database and the cookie jar out of it.
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

vi.mock("@/server/applicant/application-desk", () => ({
  resolveApplication: async (key: string) => (key === "known-key" ? memory.resolved : null),
}));

vi.mock("@/server/applicant/stuck", () => ({
  retryApplication: async (email: string, entryid: number) => {
    memory.retried.push({ email, entryid });
    if (memory.retryThrows) throw new Error("database unavailable");
    return memory.retryResult;
  },
}));

import { retryApplicationAction } from "./actions";

const ADMIN: AdminIdentity = {
  id: "usr_admin",
  name: "Админ",
  email: "admin@shunkhlai.mn",
  role: "admin",
  source: "app_user",
};

const EDITOR: AdminIdentity = { ...ADMIN, id: "usr_editor", role: "editor" };

const form = (key: string) => {
  const data = new FormData();
  data.set("key", key);
  return data;
};

beforeEach(() => {
  memory.user = ADMIN;
  memory.resolved = { email: "bat@example.mn", entryid: 55 };
  memory.retried = [];
  memory.retryResult = { ok: true };
  memory.retryThrows = false;
  memory.revalidated = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("retryApplicationAction — who may press it", () => {
  it("lets an admin hand the row back to the sync", async () => {
    const state = await retryApplicationAction({}, form("known-key"));

    expect(state).toEqual({ tone: "ok", message: "Дахин илгээхээр тавилаа." });
    expect(memory.retried).toEqual([{ email: "bat@example.mn", entryid: 55 }]);
    expect(memory.revalidated).toContain("/admin/applications");
  });

  it("refuses an editor, and does not touch the row", async () => {
    memory.user = EDITOR;

    const state = await retryApplicationAction({}, form("known-key"));

    expect(state.tone).toBe("error");
    expect(state.message).toBe("Дахин илгээх эрх байхгүй байна. Админд хандана уу.");
    // The button is not drawn for an editor; this is the check that counts,
    // because a POST does not come through the UI.
    expect(memory.retried).toEqual([]);
    expect(memory.revalidated).toEqual([]);
  });

  it("redirects a caller with no session before anything else happens", async () => {
    memory.user = null;

    await expect(retryApplicationAction({}, form("known-key"))).rejects.toThrow(
      "REDIRECT /admin/login",
    );
    expect(memory.retried).toEqual([]);
  });
});

describe("retryApplicationAction — the row it acts on", () => {
  it("takes a key and never an email, and resolves the account server-side", async () => {
    const data = new FormData();
    data.set("key", "known-key");
    // A forged email in the form is simply not read: the action only knows
    // about `key`, and the account behind it is looked up here.
    data.set("email", "someone-else@example.mn");

    await retryApplicationAction({}, data);
    expect(memory.retried).toEqual([{ email: "bat@example.mn", entryid: 55 }]);
  });

  it("says so when the key names no row", async () => {
    const state = await retryApplicationAction({}, form("unknown-key"));
    expect(state).toEqual({ tone: "error", message: "Хүсэлт олдсонгүй." });
    expect(memory.retried).toEqual([]);
  });

  it("refuses an empty key without a lookup", async () => {
    const state = await retryApplicationAction({}, form("   "));
    expect(state).toEqual({ tone: "error", message: "Хүсэлт олдсонгүй." });
  });

  it("explains a lost race rather than overwriting somebody's work", async () => {
    memory.retryResult = { ok: false, reason: "conflict" };
    const state = await retryApplicationAction({}, form("known-key"));
    expect(state.tone).toBe("error");
    expect(state.message).toContain("Хэсэг хүлээгээд");
  });

  it("turns a thrown failure into Mongolian, not a 500", async () => {
    memory.retryThrows = true;
    const state = await retryApplicationAction({}, form("known-key"));
    expect(state).toEqual({
      tone: "error",
      message: "Дахин илгээж чадсангүй. Дараа дахин оролдоно уу.",
    });
  });
});
