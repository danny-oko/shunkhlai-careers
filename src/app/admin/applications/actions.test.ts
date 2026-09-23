import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The desk's actions are POST endpoints whose ids the browser knows, and one
 * of them pushes a stranger's application into the customer's ERP. So the only
 * thing worth asserting about them in isolation is the thing that makes them
 * safe: `requireAdmin()` runs first, and nothing happens when it refuses.
 *
 * The store is mocked; this is about the order of operations, and nothing here
 * may reach a database or the ERP.
 */

/** Mirrors `RetryResult`; spelled out here because `vi.hoisted` cannot import. */
type Retry = { ok: boolean; reason?: "not_found" | "conflict" };

const stuck = vi.hoisted(() => ({
  listStuckApplications: vi.fn(async () => []),
  retryApplication: vi.fn<(email: string, entryid: number) => Promise<Retry>>(async () => ({
    ok: true,
  })),
  sweepStuckApplications: vi.fn(async () => ({ scanned: 3, claimed: 1 })),
}));

const guard = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => undefined),
}));

vi.mock("@/server/applicant/stuck", () => stuck);
vi.mock("@/server/admin/guard", () => guard);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { loadStuckApplications, retryApplicationAction, sweepAction } = await import("./actions");

/** A signed-out request: `requireAdmin()` redirects, which throws. */
function refuse() {
  guard.requireAdmin.mockImplementationOnce(async () => {
    throw new Error("NEXT_REDIRECT /admin/login");
  });
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  stuck.retryApplication.mockResolvedValue({ ok: true });
});

describe("the guard", () => {
  it("refuses to list without an admin session", async () => {
    refuse();
    await expect(loadStuckApplications()).rejects.toThrow("NEXT_REDIRECT");
    expect(stuck.listStuckApplications).not.toHaveBeenCalled();
  });

  it("refuses to retry without an admin session", async () => {
    refuse();
    await expect(
      retryApplicationAction({}, form({ email: "a@b.mn", entryid: "5" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(stuck.retryApplication).not.toHaveBeenCalled();
  });

  it("refuses to sweep without an admin session", async () => {
    refuse();
    await expect(sweepAction({})).rejects.toThrow("NEXT_REDIRECT");
    expect(stuck.sweepStuckApplications).not.toHaveBeenCalled();
  });
});

describe("retryApplicationAction", () => {
  it("passes the row through and reports in Mongolian", async () => {
    const state = await retryApplicationAction({}, form({ email: "a@b.mn", entryid: "1000000001" }));
    expect(stuck.retryApplication).toHaveBeenCalledWith("a@b.mn", 1_000_000_001);
    expect(state).toEqual({ tone: "ok", message: "Дахин илгээхээр тавилаа." });
  });

  it("rejects a malformed row without touching the store", async () => {
    expect(await retryApplicationAction({}, form({ email: "", entryid: "x" }))).toMatchObject({
      tone: "error",
    });
    expect(stuck.retryApplication).not.toHaveBeenCalled();
  });

  it("says a concurrent edit happened rather than overwriting it", async () => {
    stuck.retryApplication.mockResolvedValueOnce({ ok: false, reason: "conflict" });
    const state = await retryApplicationAction({}, form({ email: "a@b.mn", entryid: "5" }));
    expect(state.tone).toBe("error");
    expect(state.message).toContain("хүлээгээд");
  });

  it("turns a thrown failure into a message, never a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stuck.retryApplication.mockRejectedValueOnce(new Error("ECONNREFUSED 10.16.9.51:5432"));
    const state = await retryApplicationAction({}, form({ email: "a@b.mn", entryid: "5" }));
    expect(state.tone).toBe("error");
    // The infrastructure's own words are logged, not shown.
    expect(state.message).not.toContain("ECONNREFUSED");
  });
});

describe("sweepAction", () => {
  it("reports how many rows it picked up", async () => {
    expect(await sweepAction({})).toEqual({
      tone: "ok",
      message: "1 хүсэлтийг дахин илгээхээр эхлүүллээ.",
    });
  });
});
