import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FakeErp, type Row } from "./fake-erp.fixture";
import { FULL_PULL, fetchSnapshot } from "./erp-pull";
import {
  LOCAL_ID_BASE,
  applySnapshot,
  maritalOptionsOf,
  mergeApplications,
  mergeSection,
  pulledProfile,
  pullDue,
  recordLocalChange,
  SECTIONS,
  WITHDRAWN_TTL_MS,
  settleWithdrawnOnPull,
  settleWithdrawnPush,
} from "./erp-model";
import type { ApplicantDoc } from "./handlers";

/** Pull (ERP → D1): fetch + the pure merge. */

function emptyDoc(profile: Row = {}): ApplicantDoc {
  return {
    profile,
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
    applications: [],
    cv: null,
    picture: null,
  };
}

let erp: FakeErp;
let logs: string[];

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
  erp = new FakeErp((e) => {
    e.seedRow("hrappedulist", { schoolname: "МУИС" });
    e.seedRow("hrapplanglist", { note: "EN" });
    e.seedRow("hrappquallist", { qualname: "CPA" });
    e.seedRow("hrappcomplist", { note: "Excel" });
    e.seedRow("hrappexplist", { orgname: "Org" });
    e.seedRow("hrappprojectlist", { projectname: "P" });
    e.seedRow("hrappinternlist", { orgname: "I" });
    e.seedRow("hrappfamilylist", { firstname: "Эх" });
    e.seedRow("hrapprelativelist", { firstname: "Ах" });
    e.seedRow("interests", { note: "Int" });
    e.lists.requests.push({ entryid: e.id(), posname: "Нягтлан" });
    e.recruitmentorders.push({ recruitmentorderid: 707 });
    e.record.filedata = "Q1Y=";
    e.record.filename = "cv.pdf";
    e.record.picturedata = "/9j/";
  });
  vi.stubGlobal("fetch", erp.fetch);
  logs = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" ")));
});

afterEach(() => {
  expect(logs.join("\n")).not.toContain(erp.token);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fetchSnapshot", () => {
  it("reads /get, every section source and the request list — and nothing else", async () => {
    const snap = await fetchSnapshot(erp.token, FULL_PULL);
    expect(new Set(erp.endpoints())).toEqual(
      new Set(["get", "GetHrAppEducationData", "GetHrAppExperienceData", "GetHrAppFamilyData", "getInterestedJobsList", "getRecruitmenRequestList"]),
    );
    for (const c of erp.calls) {
      expect(c.method).toBe("GET");
      expect(c.auth).toBe(`Bearer ${erp.token}`);
    }
    expect(snap.record).toMatchObject({ regno: erp.regno, filename: "cv.pdf" });
    expect(snap.recruitmentorders).toEqual([{ recruitmentorderid: 707 }]);
    expect(snap.applications).toHaveLength(1);
  });

  it("keeps /get's maritalstatus[] as options (and nothing when absent or unusable)", async () => {
    expect((await fetchSnapshot(erp.token, FULL_PULL)).maritalOptions ?? null).toBeNull();
    erp.marital = [{ key: "S", text: "Ганц бие" }, { key: "", text: "x" }, { code: "M", name: "Гэрлэсэн" }];
    expect((await fetchSnapshot(erp.token, FULL_PULL)).maritalOptions).toEqual([
      { key: "S", text: "Ганц бие" },
      { key: "M", text: "Гэрлэсэн" },
    ]);
    expect(maritalOptionsOf("S")).toBeNull(); // the flat record's own code, not a list
    expect(maritalOptionsOf([])).toBeNull();
  });

  it("a failing part comes back missing, the rest still arrive; never throws", async () => {
    erp.refuse.set("GetHrAppFamilyData", "boom");
    const snap = await fetchSnapshot(erp.token, FULL_PULL);
    expect("GetHrAppFamilyData" in snap.sources).toBe(false);
    expect("GetHrAppEducationData" in snap.sources).toBe(true);
    erp.down = true;
    await expect(fetchSnapshot(erp.token, FULL_PULL)).resolves.toMatchObject({ record: null, applications: null });
  });
});

describe("applySnapshot", () => {
  it("imports profile, every section (ERP ids, erp:'synced', audit stripped), files and applications", async () => {
    const doc = emptyDoc({ regno: erp.regno, mobilephone: erp.phone });
    const effect = applySnapshot(doc, await fetchSnapshot(erp.token, FULL_PULL), new Date());
    expect(doc.profile).toMatchObject({ addr2: "ERP хаяг", custom1: "ERP custom" });
    for (const s of SECTIONS) {
      expect(doc[s.key], s.key).toHaveLength(1);
      expect(doc[s.key][0].erp).toBe("synced");
      expect(Number(doc[s.key][0].entryid)).toBeLessThan(LOCAL_ID_BASE);
      expect(doc[s.key][0]).not.toHaveProperty("createdby");
    }
    expect(doc.applications).toHaveLength(1);
    expect(doc.cv).toEqual({ filename: "cv.pdf", filedata: "Q1Y=" });
    expect(doc.picture).toContain("/9j/");
    expect(effect).toEqual({ cv: true, picture: true });
    expect(doc.erp?.appliedOrderIds).toEqual([707]);
  });

  it("stores the ERP's marital options; a pull without them keeps the last ones", async () => {
    const doc = emptyDoc({ regno: erp.regno, mobilephone: erp.phone });
    erp.marital = [{ key: "S", text: "Ганц бие" }];
    applySnapshot(doc, await fetchSnapshot(erp.token, FULL_PULL), new Date());
    expect(doc.erp?.maritalOptions).toEqual([{ key: "S", text: "Ганц бие" }]);
    expect(doc.profile).not.toHaveProperty("maritalOptions");
    erp.marital = [];
    applySnapshot(doc, await fetchSnapshot(erp.token, FULL_PULL), new Date());
    expect(doc.erp?.maritalOptions).toEqual([{ key: "S", text: "Ганц бие" }]);
  });

  it("a dirty profile is left alone", async () => {
    const doc = emptyDoc({ regno: erp.regno, mobilephone: erp.phone, addr2: "local" });
    doc.erp = { profileDirty: Date.now() };
    applySnapshot(doc, await fetchSnapshot(erp.token, FULL_PULL), new Date());
    expect(doc.profile.addr2).toBe("local");
  });

  it("blank ERP regno/phone never erase D1's (the login needs them)", () => {
    expect(pulledProfile({ regno: "R", mobilephone: "P" }, { regno: "", mobilephone: " ", addr2: "a" }).profile).toMatchObject({
      regno: "R",
      mobilephone: "P",
      addr2: "a",
    });
  });

  it("a different ERP regno/phone never replaces D1's either (the phone there is the contact number, not the password)", () => {
    for (const first of [true, false]) {
      const pulled = pulledProfile(
        { regno: "УБ99010101", mobilephone: "PASS1234" },
        { regno: "уб99010101", mobilephone: "99887766", addr2: "a" },
        first,
      );
      expect(pulled.profile).toMatchObject({ regno: "УБ99010101", mobilephone: "PASS1234", addr2: "a" });
      // Nothing to send back: D1 keeping its login is not a profile edit.
      expect(pulled.d1Only).toBe(false);
    }
    // Blank in D1 (never the case once logged in): the ERP value fills it.
    expect(pulledProfile({ regno: "R" }, { regno: "X", mobilephone: "99887766" }).profile).toMatchObject({
      regno: "R",
      mobilephone: "99887766",
    });
  });

  it("an unusable section answer keeps D1 as it is (no mass delete)", async () => {
    const doc = emptyDoc();
    doc.education = [{ entryid: 501, schoolname: "keep", erp: "synced" }];
    applySnapshot(doc, { record: null, recruitmentorders: null, sources: { GetHrAppEducationData: null }, applications: null }, new Date());
    expect(doc.education).toHaveLength(1);
    applySnapshot(doc, { record: null, recruitmentorders: null, sources: { GetHrAppEducationData: { unexpected: true } }, applications: null }, new Date());
    expect(doc.education).toHaveLength(1);
  });
});

describe("mergeSection", () => {
  const edu = SECTIONS.find((s) => s.key === "education")!;

  it("pending local rows survive a pull (edit replaces the ERP row, new rows are appended)", () => {
    const current = [
      { entryid: 501, schoolname: "local edit", erp: "pending" },
      { entryid: LOCAL_ID_BASE + 1, schoolname: "new", erp: "pending" },
    ];
    const merged = mergeSection(edu, current, [{ entryid: 501, schoolname: "erp" }, { entryid: 502, schoolname: "other" }], []);
    expect(merged.map((r) => [r.entryid, r.schoolname, r.erp])).toEqual([
      [501, "local edit", "pending"],
      [502, "other", "synced"],
      [LOCAL_ID_BASE + 1, "new", "pending"],
    ]);
  });

  it("synced rows missing from the ERP go; pending ones stay", () => {
    const merged = mergeSection(edu, [
      { entryid: 501, erp: "synced" },
      { entryid: 502, erp: "pending", schoolname: "x" },
    ], [], []);
    expect(merged.map((r) => r.entryid)).toEqual([502]);
  });

  it("a queued delete is never resurrected", () => {
    const merged = mergeSection(edu, [], [{ entryid: 501 }, { entryid: 502 }], [{ endpoint: "DeleteHrAppEducation", entryid: 501 }]);
    expect(merged.map((r) => r.entryid)).toEqual([502]);
  });

  it("applications: a queued DeleteOrderApp is not resurrected; unsent local rows stay", () => {
    const merged = mergeApplications(
      [{ entryid: LOCAL_ID_BASE + 5, recruitmentorderid: 786, erp: { status: "pending", attempts: 1, lastAttemptAt: "" } }],
      [{ entryid: 900 }, { entryid: 901 }],
      [{ endpoint: "DeleteOrderApp", entryid: 900 }],
      new Date(),
    );
    expect(merged.map((r) => r.entryid)).toEqual([901, LOCAL_ID_BASE + 5]);
  });
});

describe("recordLocalChange", () => {
  it("queues deletes only for ERP rows; local-only rows are dropped silently", () => {
    const doc = emptyDoc();
    recordLocalChange(doc, "DeleteAppExperience", true, { entryid: 501, erp: "synced" });
    recordLocalChange(doc, "DeleteAppExperience", true, { entryid: LOCAL_ID_BASE + 3, erp: "pending" });
    recordLocalChange(doc, "DeleteAppExperience", true, undefined);
    expect(doc.erp?.pendingDeletes).toEqual([{ endpoint: "DeleteAppExperience", entryid: 501 }]);
  });

  it("deleteAppCV marks the CV for an ERP delete only when the ERP had it", () => {
    const synced = emptyDoc();
    synced.erp = { cvHash: "h" };
    recordLocalChange(synced, "deleteAppCV", true, undefined);
    expect(synced.erp?.cvDirty).toBeTruthy();
    const local = emptyDoc();
    local.erp = { cvDirty: 1 };
    recordLocalChange(local, "deleteAppCV", true, undefined);
    expect(local.erp?.cvDirty).toBeUndefined();
  });
});

describe("withdrawn before the ERP id was known (tombstones)", () => {
  const now = Date.parse("2026-09-21T12:00:00Z");
  const iso = (ms: number) => new Date(ms).toISOString();
  const app = (erp: Row): Row => ({ entryid: LOCAL_ID_BASE + 7, recruitmentorderid: 786, erp });

  it("a row whose push is on the wire leaves a tombstone carrying the claim", () => {
    const doc = emptyDoc();
    doc.erp = { pulledAt: iso(now - 60 * 60_000) };
    const claimedAt = iso(now - 30_000);
    recordLocalChange(doc, "DeleteOrderApp", true, app({ status: "pending", attempts: 1, lastAttemptAt: claimedAt, claimedAt }), now);
    expect(doc.erp.withdrawn).toEqual([{ entryid: LOCAL_ID_BASE + 7, recruitmentorderid: 786, at: iso(now), claimedAt }]);
    expect(doc.erp.pendingDeletes).toBeUndefined();
  });

  it("no tombstone when a pull already ran after the last attempt (any ERP copy is its own row), or in mock mode", () => {
    const doc = emptyDoc();
    doc.erp = { pulledAt: iso(now - 60_000) };
    recordLocalChange(doc, "DeleteOrderApp", true, app({ status: "failed", attempts: 2, lastAttemptAt: iso(now - 20 * 60_000) }), now);
    recordLocalChange(doc, "DeleteOrderApp", true, app({ status: "skipped", attempts: 1, lastAttemptAt: iso(now) }), now);
    expect(doc.erp.withdrawn).toBeUndefined();
  });

  it("the push reports the ERP id → DeleteOrderApp is queued; without one the tombstone waits, no longer in flight", () => {
    const doc = emptyDoc();
    doc.erp = { withdrawn: [{ entryid: 1, recruitmentorderid: 786, at: iso(now), claimedAt: iso(now) }] };
    expect(settleWithdrawnPush(doc, 1, { status: "sent" })).toBe(false);
    expect(doc.erp.withdrawn).toEqual([{ entryid: 1, recruitmentorderid: 786, at: iso(now) }]);
    expect(settleWithdrawnPush(doc, 1, { status: "sent", erpEntryId: 900 })).toBe(true);
    expect(doc.erp.pendingDeletes).toEqual([{ endpoint: "DeleteOrderApp", entryid: 900, recruitmentorderid: 786 }]);
    expect(doc.erp.withdrawn).toBeUndefined();
  });

  it("pull: one withdrawn posting in the ERP and one unknown row → that row is cancelled", () => {
    const doc = emptyDoc();
    doc.applications = [{ entryid: 800, erp: { status: "sent", erpEntryId: 800 } }];
    doc.erp = { withdrawn: [{ entryid: 1, recruitmentorderid: 786, at: iso(now) }] };
    const queued = settleWithdrawnOnPull(doc, [{ entryid: 800 }, { entryid: 901 }], [{ recruitmentorderid: 707 }, { recruitmentorderid: 786 }], now);
    expect(queued).toBe(true);
    expect(doc.erp.pendingDeletes).toEqual([{ endpoint: "DeleteOrderApp", entryid: 901, recruitmentorderid: 786 }]);
    expect(doc.erp.withdrawn).toBeUndefined();
  });

  it("pull: never matched while the push is on the wire (the unknown row could be someone else's)", () => {
    const doc = emptyDoc();
    doc.erp = { withdrawn: [{ entryid: 1, recruitmentorderid: 786, at: iso(now), claimedAt: iso(now - 10_000) }] };
    expect(settleWithdrawnOnPull(doc, [{ entryid: 901 }], [{ recruitmentorderid: 786 }], now)).toBe(false);
    expect(doc.erp.pendingDeletes).toBeUndefined();
    expect(doc.erp.withdrawn).toHaveLength(1);
  });

  it("pull: not in the ERP and no push on the wire → dropped; still on the wire → kept", () => {
    const doc = emptyDoc();
    doc.erp = {
      withdrawn: [
        { entryid: 1, recruitmentorderid: 786, at: iso(now) },
        { entryid: 2, recruitmentorderid: 787, at: iso(now), claimedAt: iso(now - 10_000) },
      ],
    };
    expect(settleWithdrawnOnPull(doc, [], [], now)).toBe(false);
    expect(doc.erp.withdrawn?.map((t) => t.entryid)).toEqual([2]);
  });

  it("pull: ambiguous (two unknown rows) → nothing cancelled, the tombstone is given up", () => {
    const doc = emptyDoc();
    doc.erp = { withdrawn: [{ entryid: 1, recruitmentorderid: 786, at: iso(now) }] };
    expect(settleWithdrawnOnPull(doc, [{ entryid: 901 }, { entryid: 902 }], [{ recruitmentorderid: 786 }, { recruitmentorderid: 999 }], now)).toBe(false);
    expect(doc.erp.pendingDeletes).toBeUndefined();
    expect(doc.erp.withdrawn).toBeUndefined();
  });

  it("pull: a failed read changes nothing but the expiry", () => {
    const doc = emptyDoc();
    doc.erp = {
      withdrawn: [
        { entryid: 1, recruitmentorderid: 786, at: iso(now) },
        { entryid: 2, recruitmentorderid: 787, at: iso(now - WITHDRAWN_TTL_MS) },
      ],
    };
    expect(settleWithdrawnOnPull(doc, null, [{ recruitmentorderid: 786 }], now)).toBe(false);
    expect(doc.erp.withdrawn?.map((t) => t.entryid)).toEqual([1]);
  });

  it("applying to the posting again lifts its tombstone", () => {
    const doc = emptyDoc();
    doc.erp = { withdrawn: [{ entryid: 1, recruitmentorderid: 786, at: iso(now) }] };
    recordLocalChange(doc, "SaveHrRecruitmentOrderApp", { entryid: 2, recruitmentorderid: 786 }, undefined, now);
    expect(doc.erp.withdrawn).toBeUndefined();
  });
});

describe("pullDue (throttle and backoff)", () => {
  it("pulls when never pulled, not within 10 min, again after 10 min; backs off after failures", () => {
    const now = Date.parse("2026-09-21T12:00:00Z");
    const doc = emptyDoc();
    expect(pullDue(doc, now)).toBe(true);
    doc.erp = { pulledAt: new Date(now - 9 * 60_000).toISOString() };
    expect(pullDue(doc, now)).toBe(false);
    doc.erp.pulledAt = new Date(now - 10 * 60_000).toISOString();
    expect(pullDue(doc, now)).toBe(true);
    doc.erp = { pullFailures: 3, pullFailedAt: new Date(now - 30 * 60_000).toISOString() };
    expect(pullDue(doc, now)).toBe(false); // 10 * 2^2 = 40 min
    doc.erp.pullFailedAt = new Date(now - 41 * 60_000).toISOString();
    expect(pullDue(doc, now)).toBe(true);
  });
});
