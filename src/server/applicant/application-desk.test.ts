import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

/**
 * The applications desk's data source.
 *
 * Nothing here reaches a live database or the real ERP: `@/lib/db` is the
 * PGlite client built from the committed migration, and `fetch` is a function
 * in this file. A test that could touch either would be a test that can take
 * the customer's recruitment system down.
 *
 * What it is here to prove:
 *
 * - the list is read from the mirror and survives the ERP being unreachable,
 *   and the page is told which of the two it is looking at;
 * - the ERP's failures are classified from the transport, as everywhere else;
 * - the row shapes carry no регистр, no phone, and nothing an upstream
 *   response body put into the document.
 */

const state = vi.hoisted(() => ({ pg: null as TestDatabase | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");
  state.pg = await createTestDatabase();
  return { ...schema, schema, getDb: () => state.pg!.db };
});

import { applicantAccount, applicationLog } from "@/lib/db/schema";
import {
  deskSource,
  getApplication,
  listApplications,
  loadApplicationDesk,
  resolveApplication,
} from "./application-desk";
import { idempotencyKey } from "./erp-retry";

/* --- the applicant, and the things that must not leak --------------------- */

const EMAIL = "bat@example.mn";
const REGNO = "УБ99010101";
const PHONE = "99112233";
/** A refusal with the applicant's own details in it, as the ERP has sent. */
const LEAKY_RETMSG = `Бат Доржийн РД ${REGNO} буруу утга агуулж байна`;

/* --- the fake ERP --------------------------------------------------------- */

type Answer = { status: number; body: unknown } | "throw";

let erpCalls: string[];
let erpAnswer: Answer;

const POSTINGS = [
  { entryid: 786, posname: "Тээврийн менежер", remainingdays: 12 },
  { entryid: 787, posname: "Нягтлан бодогч", remainingdays: null },
  { entryid: 900, posname: "Хаагдсан зар", remainingdays: -3 },
];

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.invalid");
  erpCalls = [];
  erpAnswer = { status: 200, body: { rettype: 0, retmsg: "", retdata: POSTINGS } };
  await state.pg!.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});

  vi.stubGlobal("fetch", async (input: unknown) => {
    erpCalls.push(String(input));
    if (erpAnswer === "throw") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(erpAnswer.body), {
      status: erpAnswer.status,
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

type ErpMarker = Record<string, unknown>;

function application(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entryid: 1_000_000_001,
    recruitmentorderid: 786,
    posname: "Тээврийн менежер",
    companyname: "Шунхлай Групп",
    locname: "Улаанбаатар",
    salaryname: "1.5 - 2.0 сая",
    availabledate: "2026-10-01",
    statusname: "Хүлээгдэж буй",
    ...over,
  };
}

/**
 * One account with one application. The profile holds the регистр and the
 * phone because a real one does — that is exactly what makes the assertions
 * below worth making.
 */
async function seed({
  email = EMAIL,
  clerkUserId = "user_1" as string | null,
  apps,
  extra = {},
}: {
  email?: string;
  clerkUserId?: string | null;
  apps: Array<{ row?: Record<string, unknown>; erp?: ErpMarker }>;
  extra?: Record<string, unknown>;
}) {
  const doc = {
    profile: {
      firstname: "Бат",
      lastname: "Дорж",
      regno: REGNO,
      mobilephone: PHONE,
      email2: email,
    },
    applications: apps.map(({ row, erp }) => ({ ...application(row), ...(erp ? { erp } : {}) })),
    cv: { filename: "Бат_Дорж_CV.pdf" },
    picture: true,
    nextEntryId: 1_000_000_002,
    ...extra,
  };

  await state.pg!.db.insert(applicantAccount).values({
    id: `acc_${email}`,
    email,
    clerkUserId,
    dataJson: JSON.stringify(doc),
  });
}

const sentMarker = (over: ErpMarker = {}): ErpMarker => ({
  status: "sent",
  attempts: 1,
  lastAttemptAt: "2026-09-20T08:00:00.000Z",
  submittedAt: "2026-09-20T07:59:00.000Z",
  erpEntryId: 4242,
  key: idempotencyKey(EMAIL, 786),
  ...over,
});

/* --- the list ------------------------------------------------------------- */

describe("listApplications", () => {
  it("reads every application in the mirror, newest first", async () => {
    await seed({
      apps: [
        { row: { entryid: 1, recruitmentorderid: 786 }, erp: sentMarker({ submittedAt: "2026-09-01T00:00:00.000Z" }) },
        { row: { entryid: 2, recruitmentorderid: 787, posname: "Нягтлан бодогч" }, erp: sentMarker({ submittedAt: "2026-09-22T00:00:00.000Z", key: idempotencyKey(EMAIL, 787) }) },
      ],
    });

    const rows = await listApplications();
    expect(rows.map((row) => row.jobId)).toEqual([787, 786]);
    expect(rows[0].name).toBe("Дорж Бат");
  });

  it("falls back to the ERP's own senddate when this site never stamped one", async () => {
    await seed({ apps: [{ row: { senddate: "2026.08.14" } }] });
    const [row] = await listApplications();
    expect(row.appliedAt).toBe("2026.08.14");
    expect(row.push.status).toBe("unknown");
  });

  it("gives a row with no stored key the same key the retry policy would", async () => {
    await seed({ apps: [{ erp: { status: "pending", attempts: 0, lastAttemptAt: "" } }] });
    const [row] = await listApplications();
    expect(row.key).toBe(idempotencyKey(EMAIL, 786));
  });

  it("survives a document that is not valid JSON", async () => {
    await state.pg!.db.insert(applicantAccount).values({
      id: "acc_broken",
      email: "broken@example.mn",
      clerkUserId: null,
      dataJson: "{not json",
    });
    await expect(listApplications()).resolves.toEqual([]);
  });
});

/* --- the source, and the fallback ----------------------------------------- */

describe("the source banner", () => {
  it("reports the ERP as reachable, with the postings it is advertising", async () => {
    const { source, openPostings } = await deskSource();
    expect(source.rows).toBe("mirror");
    expect(source.erp).toEqual({ reachable: true, postings: 2 });
    // The closed advert is not counted as open; the open-ended one is.
    expect([...openPostings].sort()).toEqual([786, 787]);
  });

  it("falls back to the mirror, with a classified reason, when the ERP does not answer", async () => {
    erpAnswer = "throw";
    await seed({ apps: [{ erp: sentMarker() }] });

    const desk = await loadApplicationDesk();

    expect(desk.source).toEqual({
      rows: "mirror",
      erp: { reachable: false, reason: "erp_unreachable" },
    });
    // The point of the fallback: the list is untouched.
    expect(desk.rows).toHaveLength(1);
    expect(desk.openPostings.size).toBe(0);
  });

  it("classifies a sick ERP as unavailable rather than unreachable", async () => {
    erpAnswer = { status: 503, body: { rettype: -1, retmsg: LEAKY_RETMSG } };
    const { source } = await deskSource();
    expect(source.erp).toEqual({ reachable: false, reason: "erp_unavailable" });
  });

  it("never reads the ERP's own words, even when it refuses", async () => {
    erpAnswer = { status: 400, body: { rettype: -1, retmsg: LEAKY_RETMSG } };
    const { source } = await deskSource();
    expect(JSON.stringify(source)).not.toContain(REGNO);
    expect(JSON.stringify(source)).not.toContain("Бат");
    expect(source.erp).toEqual({ reachable: false, reason: "erp_apply_rejected" });
  });

  it("does not call the ERP at all when none is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { source } = await deskSource();
    expect(source.erp).toEqual({ reachable: false, reason: "erp_not_configured" });
    expect(erpCalls).toEqual([]);
  });

  it("asks the ERP only for the public posting list", async () => {
    await deskSource();
    expect(erpCalls).toHaveLength(1);
    expect(erpCalls[0]).toContain("/api/applicant/getRecruitmentOrderList");
    // No applicant-scoped endpoint, and so no applicant's credentials spent.
    expect(erpCalls[0]).not.toContain("auth/login");
  });
});

/* --- one application ------------------------------------------------------ */

describe("getApplication", () => {
  it("finds the row by its key and fills in the record", async () => {
    await seed({ apps: [{ erp: sentMarker() }] });
    const [row] = await listApplications();

    const found = await getApplication(row.key);
    expect(found).toMatchObject({
      email: EMAIL,
      company: "Шунхлай Групп",
      location: "Улаанбаатар",
      salary: "1.5 - 2.0 сая",
      hasCv: true,
      hasPhoto: true,
      erpStatus: "Хүлээгдэж буй",
    });
    expect(found?.push.erpEntryId).toBe(4242);
  });

  it("answers null for a key nobody has", async () => {
    await seed({ apps: [{ erp: sentMarker() }] });
    await expect(getApplication("0".repeat(24))).resolves.toBeNull();
  });

  it("reads the legacy application_log row without its error message", async () => {
    await seed({ apps: [{ erp: sentMarker() }] });
    await state.pg!.db.insert(applicationLog).values({
      id: "log_1",
      clerkUserId: "user_1",
      jobId: 786,
      status: "failed",
      erpApplicationId: 99,
      errorMessage: LEAKY_RETMSG,
    });

    const [row] = await listApplications();
    const found = await getApplication(row.key);

    expect(found?.log).toMatchObject({ status: "failed", erpApplicationId: 99 });
    expect(JSON.stringify(found)).not.toContain(LEAKY_RETMSG);
    expect(JSON.stringify(found)).not.toContain(REGNO);
  });

  it("resolves a key back to the account for an action that has to write", async () => {
    await seed({ apps: [{ row: { entryid: 55 }, erp: sentMarker() }] });
    const [row] = await listApplications();
    await expect(resolveApplication(row.key)).resolves.toEqual({ email: EMAIL, entryid: 55 });
    await expect(resolveApplication("nope")).resolves.toBeNull();
  });
});

/* --- PII ------------------------------------------------------------------ */

describe("what the shapes carry", () => {
  it("keeps регистр, phone and the account email out of the list rows", async () => {
    await seed({ apps: [{ erp: sentMarker() }] });
    const serialized = JSON.stringify(await listApplications());

    expect(serialized).not.toContain(REGNO);
    expect(serialized).not.toContain(PHONE);
    // The email is the detail view's, not the list's — see `DeskApplication`.
    expect(serialized).not.toContain(EMAIL);
  });

  it("keeps регистр, phone and the CV's file name out of the detail", async () => {
    await seed({ apps: [{ erp: sentMarker() }] });
    const [row] = await listApplications();
    const serialized = JSON.stringify(await getApplication(row.key));

    expect(serialized).not.toContain(REGNO);
    expect(serialized).not.toContain(PHONE);
    expect(serialized).not.toContain("Бат_Дорж_CV.pdf");
    // The email *is* here: it is the account key and how HR reaches them.
    expect(serialized).toContain(EMAIL);
  });

  it("never carries a stored ERP message off the document", async () => {
    // `erp.withdrawRefused` is the one place the document keeps an upstream
    // `retmsg` — `/api/me` shows it to the applicant whose refusal it is, and
    // this desk must not repeat it to somebody else.
    await seed({
      apps: [{ erp: sentMarker() }],
      extra: { erp: { withdrawRefused: { "4242": LEAKY_RETMSG } } },
    });

    const [row] = await listApplications();
    const everything = JSON.stringify([row, await getApplication(row.key)]);
    expect(everything).not.toContain(LEAKY_RETMSG);
    expect(everything).not.toContain(REGNO);
  });
});
