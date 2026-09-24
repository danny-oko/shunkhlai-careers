import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

/**
 * What actually reaches the screen.
 *
 * The other tests assert on the shapes the desk builds; this one renders the
 * components those shapes feed and reads the HTML, because "no register number
 * on this page" is a claim about markup and nothing else can prove it.
 *
 * The rows are not hand-written fixtures. A document is seeded into PGlite
 * with everything a real one carries — регистр, утас, the CV's file name, and
 * the one raw ERP message the document is allowed to keep (`withdrawRefused`)
 * — and then read back through the real `listApplications` / `getApplication`
 * and rendered. So the assertions below cover the whole path, not a fixture
 * that was already clean.
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
import { ApplicationDetail } from "@/components/admin/application-detail";
import { ApplicationRow } from "@/components/admin/application-row";
import { ApplicationSource } from "@/components/admin/application-source";
import {
  type DeskSource,
  getApplication,
  listApplications,
} from "@/server/applicant/application-desk";

/* --- the applicant, and everything that must not be printed --------------- */

const EMAIL = "bat@example.mn";
const REGNO = "УБ99010101";
const PHONE = "99112233";
const CV_NAME = "Бат_Дорж_CV.pdf";
/** Two upstream messages, both carrying the applicant's own details back. */
const WITHDRAW_RETMSG = `Бат Доржийн РД ${REGNO}, утас ${PHONE} — цуцлах боломжгүй`;
const LOG_RETMSG = `ORA-01438: ${REGNO} / ${PHONE}`;

/** Everything that may never appear in the markup of any screen here. */
const SECRETS = [REGNO, PHONE, CV_NAME, WITHDRAW_RETMSG, LOG_RETMSG];

const ERP_UP: DeskSource = { rows: "mirror", erp: { reachable: true, postings: 4 } };
const ERP_DOWN: DeskSource = {
  rows: "mirror",
  erp: { reachable: false, reason: "erp_unreachable" },
};

beforeEach(async () => {
  await state.pg!.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});

  await state.pg!.db.insert(applicantAccount).values({
    id: "acc_1",
    email: EMAIL,
    clerkUserId: "user_1",
    dataJson: JSON.stringify({
      profile: {
        firstname: "Бат",
        lastname: "Дорж",
        regno: REGNO,
        mobilephone: PHONE,
        email2: EMAIL,
      },
      cv: { filename: CV_NAME },
      picture: true,
      erp: { withdrawRefused: { "4242": WITHDRAW_RETMSG } },
      applications: [
        {
          entryid: 1_000_000_001,
          recruitmentorderid: 786,
          posname: "Тээврийн менежер",
          companyname: "Шунхлай Групп",
          locname: "Улаанбаатар",
          salaryname: "1.5 - 2.0 сая",
          availabledate: "2026-10-01",
          statusname: "Хүлээгдэж буй",
          erp: {
            status: "failed",
            terminal: true,
            error: "erp_apply_rejected",
            attempts: 3,
            lastAttemptAt: "2026-09-21T10:30:00.000Z",
            submittedAt: "2026-09-20T07:59:00.000Z",
            erpEntryId: 4242,
            key: "a".repeat(24),
          },
        },
      ],
    }),
  });

  await state.pg!.db.insert(applicationLog).values({
    id: "log_1",
    clerkUserId: "user_1",
    jobId: 786,
    status: "failed",
    erpApplicationId: 4242,
    errorMessage: LOG_RETMSG,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const listMarkup = async () => {
  const rows = await listApplications();
  return renderToStaticMarkup(
    React.createElement(
      "ul",
      null,
      rows.map((row) => React.createElement(ApplicationRow, { key: row.key, row })),
    ),
  );
};

const detailMarkup = async (source: DeskSource = ERP_UP) => {
  const [row] = await listApplications();
  const application = await getApplication(row.key);
  if (!application) throw new Error("the seeded application was not found");
  return renderToStaticMarkup(
    React.createElement(ApplicationDetail, {
      application,
      source,
      openPostings: new Set([786]),
    }),
  );
};

/* --- the list ------------------------------------------------------------- */

describe("the list", () => {
  it("shows the name, the job, the push state and the date", async () => {
    const html = await listMarkup();
    expect(html).toContain("Дорж Бат");
    expect(html).toContain("Тээврийн менежер");
    expect(html).toContain("Анхаарал шаардлагатай");
    expect(html).toContain("2026.09.20");
  });

  it("addresses the detail view by the row key, not by an email", async () => {
    const html = await listMarkup();
    expect(html).toContain(`/admin/applications/${"a".repeat(24)}`);
    expect(html).not.toContain(EMAIL);
    expect(html).not.toContain("mailto");
  });

  it("prints no register number, no phone and nothing the ERP said", async () => {
    const html = await listMarkup();
    for (const secret of SECRETS) expect(html, secret).not.toContain(secret);
  });
});

/* --- the detail ----------------------------------------------------------- */

describe("the detail view", () => {
  it("shows the fuller record and the push state", async () => {
    const html = await detailMarkup();
    expect(html).toContain("Шунхлай Групп");
    expect(html).toContain("Улаанбаатар");
    expect(html).toContain("1.5 - 2.0 сая");
    expect(html).toContain("Анхаарал шаардлагатай");
    // The failure, as a classified code turned into Mongolian.
    expect(html).toContain("ERP хүсэлтийг хүлээж авсангүй");
    expect(html).toContain("3/5");
    expect(html).toContain("4242");
  });

  it("states that a CV exists without naming it or linking to it", async () => {
    const html = await detailMarkup();
    expect(html).toContain("Хавсаргасан");
    expect(html).not.toContain(CV_NAME);
    // No second route serving applicant files: the CV stays behind `/api/me/cv`,
    // which answers the signed-in applicant with their own file and nobody else.
    expect(html).not.toContain("/api/me/cv");
    expect(html).not.toMatch(/href="[^"]*cv[^"]*"/iu);
  });

  it("prints no register number, no phone and nothing the ERP said", async () => {
    const html = await detailMarkup();
    for (const secret of SECRETS) expect(html, secret).not.toContain(secret);
  });

  it("does print the account email — the one identifier the desk needs", async () => {
    const html = await detailMarkup();
    expect(html).toContain(EMAIL);
  });

  it("says the posting is still advertised only when the ERP answered", async () => {
    expect(await detailMarkup(ERP_UP)).toContain("Зарын төлөв");
    expect(await detailMarkup(ERP_DOWN)).not.toContain("Зарын төлөв");
  });
});

/* --- the source banner ---------------------------------------------------- */

describe("the source banner", () => {
  const render = (source: DeskSource) =>
    renderToStaticMarkup(React.createElement(ApplicationSource, { source }));

  it("names the mirror as the source, and says what it does not hold", () => {
    const html = render(ERP_UP);
    expect(html).toContain("Эх сурвалж: энэ сайтын толь");
    expect(html).toContain("ERP-д шууд ирсэн өргөдөл энэ жагсаалтад ороогүй болно.");
  });

  it("reports a reachable ERP, and how many adverts it is carrying", () => {
    expect(render(ERP_UP)).toContain("ERP хариу өглөө — 4 зар нээлттэй байна.");
  });

  it("reports the fallback in Mongolian, from the classified reason", () => {
    const html = render(ERP_DOWN);
    expect(html).toContain("ERP-д холбогдож чадсангүй");
    expect(html).toContain("жагсаалт тольноос уншигдлаа");
    // The strip turns destructive only for a real failure.
    expect(html).toContain("border-destructive/30");
  });

  it("does not shout at a deployment that simply has no ERP configured", () => {
    const html = render({
      rows: "mirror",
      erp: { reachable: false, reason: "erp_not_configured" },
    });
    expect(html).toContain("ERP хаяг тохируулаагүй байна");
    expect(html).not.toContain("border-destructive/30");
  });
});
