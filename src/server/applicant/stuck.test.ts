import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

/**
 * The durability half of the apply path, end to end, against a real in-memory
 * PostgreSQL (PGlite, built from the committed migration) with a fake ERP
 * behind global `fetch`.
 *
 * Nothing here reaches a live database or the real ERP: `@/lib/db` is replaced
 * with the PGlite-backed client, and `fetch` is a function in this file. A test
 * that could touch either would be a test that can take the customer's
 * recruitment system down.
 *
 * What it is here to prove:
 *
 * - an application that was committed locally and never pushed (the process
 *   died in between) is picked up by a later sweep;
 * - two sweeps running at once do not push the same application twice;
 * - a refusal from the ERP goes terminal instead of retrying forever;
 * - no upstream message is ever written into `applicant_account`.
 */

const state = vi.hoisted(() => ({ pg: null as TestDatabase | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");
  state.pg = await createTestDatabase();
  return { ...schema, schema, getDb: () => state.pg!.db };
});

import { applicantAccount } from "@/lib/db/schema";
import { MAX_ATTEMPTS } from "./erp-retry";
import { listStuckApplications, retryApplication, sweepStuckApplications } from "./stuck";

/* --- the fake ERP --------------------------------------------------------- */

const EMAIL = "bat@example.mn";
const ORDER_ID = 786;
/** A refusal with the applicant's own details in it — exactly what must not land. */
const LEAKY_RETMSG = "Бат Доржийн РД АА12345678 буруу утга агуулж байна";

type Call = { endpoint: string; body: unknown };

let calls: Call[];
/** Per-endpoint answer: an envelope, or a thrown transport failure. */
let applyAnswer: () => { status: number; body: unknown };

const ok = (retdata: unknown) => ({ status: 200, body: { rettype: 0, retmsg: "", retdata } });

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.invalid");
  calls = [];
  applyAnswer = () => ok({ entryid: 4242 });
  await state.pg!.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});

  vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
    const endpoint = String(input).split("/api/applicant/")[1]?.split("?")[0] ?? "";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ endpoint, body });

    const answer =
      endpoint === "auth/login"
        ? ok({ access_token: "tok" })
        : endpoint === "get"
          ? ok({ applicantdata: [{ regno: "УБ99010101", firstname: "Бат", lastname: "Дорж" }] })
          : endpoint === "SaveHrRecruitmentOrderApp"
            ? applyAnswer()
            : endpoint === "getRecruitmenRequestList"
              ? ok([{ entryid: 4242 }])
              : ok(null);

    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { "content-type": "application/json" },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* --- fixtures ------------------------------------------------------------- */

const LONG_AGO = new Date(0).toISOString();

type ErpMarker = Record<string, unknown>;

/**
 * An account whose application is durable in Postgres and whose ERP push has
 * not happened. This is the state the process is in between the commit and the
 * push, so writing it straight into the table *is* the crash.
 */
async function seedAccount(erp: ErpMarker) {
  const doc = {
    profile: {
      regno: "УБ99010101",
      mobilephone: "99112233",
      firstname: "Бат",
      lastname: "Дорж",
      email2: EMAIL,
    },
    education: [],
    languages: [],
    qualifications: [],
    skills: [],
    experience: [],
    projects: [],
    internships: [],
    family: [],
    relatives: [],
    interests: [],
    applications: [
      {
        entryid: 1_000_000_001,
        recruitmentorderid: ORDER_ID,
        posname: "Нягтлан бодогч",
        sourcetype: "WEB",
        erp,
      },
    ],
    cv: null,
    picture: false,
    nextEntryId: 1_000_000_001,
  };
  const now = new Date(Date.now() - 60 * 60_000);
  await state.pg!.db.insert(applicantAccount).values({
    id: crypto.randomUUID(),
    email: EMAIL,
    clerkUserId: "u1",
    dataJson: JSON.stringify(doc),
    createdAt: now,
    updatedAt: now,
  });
}

const storedJson = async () => {
  const [row] = await state.pg!.db.select().from(applicantAccount);
  return row.dataJson;
};

const storedApp = async () => {
  const doc = JSON.parse(await storedJson()) as { applications: Array<Record<string, unknown>> };
  return doc.applications[0];
};

const storedErp = async () => (await storedApp()).erp as Record<string, unknown>;

const applyCalls = () => calls.filter((call) => call.endpoint === "SaveHrRecruitmentOrderApp");

/* --- no lost work on crash ------------------------------------------------ */

describe("crash between the local write and the push", () => {
  it("a later sweep finds the row and pushes it", async () => {
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });

    const report = await sweepStuckApplications();

    expect(report.claimed).toBe(1);
    expect(applyCalls()).toHaveLength(1);
    expect(applyCalls()[0].body).toMatchObject({ recruitmentorderid: ORDER_ID });
    expect(await storedErp()).toMatchObject({ status: "sent", erpEntryId: 4242 });
  });

  it("the sweep leaves alone a row another run has just claimed", async () => {
    await seedAccount({
      status: "pending",
      attempts: 1,
      lastAttemptAt: LONG_AGO,
      claimedAt: new Date().toISOString(),
      key: "k",
    });

    const report = await sweepStuckApplications();

    expect(report.claimed).toBe(0);
    expect(applyCalls()).toHaveLength(0);
  });

  it("two sweeps at once push the application once, not twice", async () => {
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });

    // The lease is taken inside `applicant_account`'s optimistic lock, so of
    // two racing claims exactly one writes and the other reloads, sees the
    // fresh `claimedAt`, and claims nothing.
    await Promise.all([sweepStuckApplications(), sweepStuckApplications()]);

    expect(applyCalls()).toHaveLength(1);
    expect(await storedErp()).toMatchObject({ status: "sent" });
  });

  it("a sent row is not swept again", async () => {
    await seedAccount({ status: "sent", attempts: 1, lastAttemptAt: LONG_AGO, erpEntryId: 4242 });

    const report = await sweepStuckApplications();

    expect(report.claimed).toBe(0);
    expect(applyCalls()).toHaveLength(0);
  });
});

/* --- the state machine ---------------------------------------------------- */

describe("state transitions", () => {
  it("pending → sent when the ERP takes it", async () => {
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });
    await sweepStuckApplications();
    expect(await storedErp()).toMatchObject({ status: "sent" });
    expect((await storedErp()).terminal).toBeUndefined();
  });

  it("pending → failed, still retryable, when the ERP is unreachable", async () => {
    applyAnswer = () => ({ status: 503, body: { message: "Service Unavailable" } });
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });

    await sweepStuckApplications();

    const erp = await storedErp();
    expect(erp).toMatchObject({ status: "failed", error: "erp_unavailable" });
    expect(erp.terminal).toBeUndefined();
  });

  it("pending → failed + terminal when the ERP refuses the payload", async () => {
    applyAnswer = () => ({ status: 200, body: { rettype: 1, retmsg: LEAKY_RETMSG, retdata: null } });
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });

    await sweepStuckApplications();

    expect(await storedErp()).toMatchObject({
      status: "failed",
      error: "erp_apply_rejected",
      terminal: true,
    });
  });

  it("a terminal row is never swept again, however long it waits", async () => {
    applyAnswer = () => ({ status: 400, body: { rettype: 1, retmsg: "буруу", retdata: null } });
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });
    await sweepStuckApplications();
    expect(applyCalls()).toHaveLength(1);

    calls = [];
    const report = await sweepStuckApplications({ now: Date.now() + 30 * 24 * 60 * 60_000 });

    expect(report.claimed).toBe(0);
    expect(applyCalls()).toHaveLength(0);
  });

  it("the last attempt is terminal even when the failure was retryable", async () => {
    applyAnswer = () => ({ status: 503, body: { message: "Service Unavailable" } });
    await seedAccount({
      status: "failed",
      attempts: MAX_ATTEMPTS - 1,
      lastAttemptAt: LONG_AGO,
      error: "erp_unavailable",
      key: "k",
    });

    await sweepStuckApplications();

    const erp = await storedErp();
    expect(erp.attempts).toBe(MAX_ATTEMPTS);
    expect(erp.terminal).toBe(true);
  });

  it("a duplicate refusal from the ERP is success, not a failure", async () => {
    // The row was already created by a push whose answer we never saw.
    applyAnswer = () => ({
      status: 200,
      body: { rettype: 1, retmsg: "Энэ ажлын байранд аль хэдийн хүсэлт илгээсэн байна", retdata: null },
    });
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });

    await sweepStuckApplications();

    // The id comes from the request list, not from the refused call.
    expect(await storedErp()).toMatchObject({ status: "sent", erpEntryId: 4242 });
  });
});

/* --- nothing upstream reaches the database -------------------------------- */

describe("the ERP's own words stay in the ERP", () => {
  it("a refusal is stored as a code, never as its message", async () => {
    applyAnswer = () => ({ status: 400, body: { rettype: 1, retmsg: LEAKY_RETMSG, retdata: null } });
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });

    await sweepStuckApplications();

    const json = await storedJson();
    expect(json).not.toContain("АА12345678");
    expect(json).not.toContain("буруу утга");
    expect((await storedErp()).error).toBe("erp_apply_rejected");
  });

  it("nor does it reach the admin desk", async () => {
    applyAnswer = () => ({ status: 400, body: { rettype: 1, retmsg: LEAKY_RETMSG, retdata: null } });
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });
    await sweepStuckApplications();

    const rows = await listStuckApplications();

    expect(JSON.stringify(rows)).not.toContain("АА12345678");
    expect(rows[0]).toMatchObject({ error: "erp_apply_rejected", terminal: true });
  });
});

/* --- visibility ----------------------------------------------------------- */

describe("listStuckApplications", () => {
  it("lists a terminal row straight away", async () => {
    await seedAccount({
      status: "failed",
      attempts: MAX_ATTEMPTS,
      lastAttemptAt: new Date().toISOString(),
      error: "erp_unavailable",
      terminal: true,
      key: "k",
      submittedAt: new Date().toISOString(),
    });

    const rows = await listStuckApplications();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: EMAIL,
      recruitmentorderid: ORDER_ID,
      posname: "Нягтлан бодогч",
      attempts: MAX_ATTEMPTS,
      terminal: true,
    });
  });

  it("does not list a push that started a moment ago", async () => {
    await seedAccount({
      status: "pending",
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
      claimedAt: new Date().toISOString(),
      key: "k",
    });

    expect(await listStuckApplications()).toEqual([]);
  });

  it("does not list an application the ERP already has", async () => {
    await seedAccount({ status: "sent", attempts: 1, lastAttemptAt: LONG_AGO, erpEntryId: 4242 });
    expect(await listStuckApplications()).toEqual([]);
  });
});

describe("retryApplication", () => {
  it("brings a terminal row back and pushes it", async () => {
    applyAnswer = () => ({ status: 400, body: { rettype: 1, retmsg: LEAKY_RETMSG, retdata: null } });
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });
    await sweepStuckApplications();
    expect((await storedErp()).terminal).toBe(true);

    applyAnswer = () => ok({ entryid: 4242 });
    calls = [];
    const result = await retryApplication(EMAIL.toUpperCase(), 1_000_000_001);

    expect(result.ok).toBe(true);
    expect(applyCalls()).toHaveLength(1);
    expect(await storedErp()).toMatchObject({ status: "sent" });
    expect(await listStuckApplications()).toEqual([]);
  });

  it("says so rather than guessing when the row is not there", async () => {
    await seedAccount({ status: "pending", attempts: 1, lastAttemptAt: LONG_AGO, key: "k" });
    expect(await retryApplication(EMAIL, 999)).toEqual({ ok: false, reason: "not_found" });
    expect(await retryApplication("nobody@example.mn", 1)).toEqual({ ok: false, reason: "not_found" });
    expect(applyCalls()).toHaveLength(0);
  });

  it("keeps the submitted timestamp and the idempotency key across the retry", async () => {
    const submittedAt = "2026-09-20T08:00:00.000Z";
    await seedAccount({
      status: "failed",
      attempts: MAX_ATTEMPTS,
      lastAttemptAt: LONG_AGO,
      error: "erp_unavailable",
      terminal: true,
      key: "stable-key",
      submittedAt,
    });

    await retryApplication(EMAIL, 1_000_000_001);

    expect(await storedErp()).toMatchObject({ key: "stable-key", submittedAt });
  });
});
