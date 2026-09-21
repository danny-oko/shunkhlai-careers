/**
 * Test-only: a stateful fake of the live ERP (careers.shunkhlai.mn), served
 * through a `fetch` replacement. It holds the applicant's record, every list,
 * the CV/photo and the request list, assigns entry ids, and enforces the
 * Postman collection's delete query-parameter casing. Nothing here talks to the
 * network.
 */

export type Row = Record<string, unknown>;

export type FakeCall = {
  method: string;
  endpoint: string;
  params: URLSearchParams;
  body: unknown;
  auth: string | null;
};

type ListName =
  | "hrappedulist"
  | "hrapplanglist"
  | "hrappquallist"
  | "hrappcomplist"
  | "hrappexplist"
  | "hrappprojectlist"
  | "hrappinternlist"
  | "hrappfamilylist"
  | "hrapprelativelist"
  | "interests"
  | "requests";

/** Save endpoint → list; `batch` saves take an array. */
const SAVES: Record<string, { list: ListName; batch?: boolean }> = {
  SaveHrAppEducation: { list: "hrappedulist" },
  SaveAppForLanguage: { list: "hrapplanglist" },
  SaveAppSkillComp: { list: "hrappcomplist", batch: true },
  SaveAppExperience: { list: "hrappexplist" },
  SaveAppFamily: { list: "hrappfamilylist", batch: true },
  SaveInterestedJobItem: { list: "interests" },
};

/** Delete endpoint → list and the EXACT query parameter from the Postman collection. */
export const ERP_DELETES: Record<string, { list: ListName; param: string }> = {
  DeleteHrAppEducation: { list: "hrappedulist", param: "ENTRYID" },
  DeleteAppForLanguage: { list: "hrapplanglist", param: "entryid" },
  DeleteAppSkillComp: { list: "hrappcomplist", param: "entryid" },
  DeleteAppExperience: { list: "hrappexplist", param: "entryid" },
  DeleteAppFamily: { list: "hrappfamilylist", param: "entryid" },
  deleteInterestedJob: { list: "interests", param: "entryid" },
  DeleteOrderApp: { list: "requests", param: "entryID" },
};

export class FakeErp {
  regno = "УБ99010101";
  phone = "99112233";
  token = "tok-FAKE-ERP-SECRET-9f8e7d";

  record: Row = {};
  lists: Record<ListName, Row[]> = {
    hrappedulist: [],
    hrapplanglist: [],
    hrappquallist: [],
    hrappcomplist: [],
    hrappexplist: [],
    hrappprojectlist: [],
    hrappinternlist: [],
    hrappfamilylist: [],
    hrapprelativelist: [],
    interests: [],
    requests: [],
  };
  recruitmentorders: Row[] = [];
  calls: FakeCall[] = [];
  nextId = 500;

  /** Whole ERP unreachable (network error). */
  down = false;
  /** Endpoints that answer rettype 1 with this message. */
  refuse = new Map<string, string>();
  /** Delay (ms) before answering any call — driven by the test's timers. */
  delayMs = 0;

  constructor(seed?: (erp: FakeErp) => void) {
    this.record = {
      lastname: "Дорж",
      firstname: "Бат",
      regno: this.regno,
      mobilephone: this.phone,
      email2: "bat@erp.mn",
      addr2: "ERP хаяг",
      contactname: "ERP холбоо",
      custom1: "ERP custom",
      isa: true,
    };
    seed?.(this);
  }

  id() {
    this.nextId += 1;
    return this.nextId;
  }

  seedRow(list: ListName, row: Row): Row {
    const created = { entryid: this.id(), createdby: 42, createddate: "2026-01-01", ...row };
    this.lists[list].push(created);
    return created;
  }

  endpoints() {
    return this.calls.map((c) => c.endpoint);
  }

  /** The `fetch` replacement. */
  fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
    const endpoint = url.pathname.replace(/^\/api\/applicant\//, "");
    const headers = new Headers(init?.headers);
    const body = await readBody(init);
    this.calls.push({ method: init?.method ?? "GET", endpoint, params: url.searchParams, body, auth: headers.get("authorization") });

    if (this.delayMs > 0) {
      const signal = init?.signal;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, this.delayMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(signal.reason ?? new DOMException("aborted", "AbortError"));
        });
      });
    }
    if (this.down) throw new TypeError("fetch failed");
    const refusal = this.refuse.get(endpoint);
    if (refusal) return env(null, 1, refusal);
    return this.answer(endpoint, url.searchParams, body, headers.get("authorization"));
  };

  private answer(endpoint: string, params: URLSearchParams, body: unknown, auth: string | null): Response {
    if (endpoint === "auth/login") {
      const b = body as { regNo?: string; mobile?: string } | null;
      if (b?.regNo !== this.regno || b?.mobile !== this.phone) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
      return new Response(JSON.stringify({ access_token: this.token }), { status: 200 });
    }
    if (endpoint === "SaveHrAppUser") return env(null, 1, "SaveHrAppUser must never be called");
    if (auth !== `Bearer ${this.token}`) return env(null, 1, "Нэвтрэх шаардлагатай.");

    const L = this.lists;
    switch (endpoint) {
      case "get":
        return env({ applicantdata: [{ ...this.record, persinfoper: 50 }], recruitmentorders: this.recruitmentorders });
      case "GetHrAppEducationData":
        return env({ hrappedulist: L.hrappedulist, hrapplanglist: L.hrapplanglist, hrappquallist: L.hrappquallist, hrappcomplist: L.hrappcomplist });
      case "GetHrAppExperienceData":
        return env({ hrappexplist: L.hrappexplist, hrappprojectlist: L.hrappprojectlist, hrappinternlist: L.hrappinternlist });
      case "GetHrAppFamilyData":
        return env({ hrappfamilylist: L.hrappfamilylist, hrapprelativelist: L.hrapprelativelist });
      case "getInterestedJobsList":
        return env(L.interests);
      case "getRecruitmenRequestList":
        // Like the real list: no recruitmentorderid.
        return env(L.requests.map(({ recruitmentorderid: _drop, ...row }) => row));
      case "SaveHrApplicant": {
        // Full replace: whatever is not sent is reset (files are separate).
        const { filedata, filename, picturedata } = this.record;
        this.record = { ...(body as Row), filedata, filename, picturedata };
        return env(true);
      }
      case "SaveAppCV": {
        const f = body as { filename: string; bytes: string } | null;
        if (!f) return env(null, 1, "file not selected");
        this.record.filedata = f.bytes;
        this.record.filename = f.filename;
        return env(true);
      }
      case "deleteAppCV":
        this.record.filedata = null;
        this.record.filename = null;
        return env(true);
      case "SaveAppPicture": {
        const f = body as { bytes: string } | null;
        this.record.picturedata = f?.bytes ?? null;
        return env(true);
      }
      case "SaveHrRecruitmentOrderApp": {
        const b = body as Row;
        const id = Number(b.recruitmentorderid);
        if (this.recruitmentorders.some((o) => Number(o.recruitmentorderid) === id)) {
          return env(null, 1, "Та энэ ажлын байранд аль хэдийн анкет илгээсэн байна.");
        }
        this.recruitmentorders.push({ recruitmentorderid: id });
        this.lists.requests.push({ entryid: this.id(), recruitmentorderid: id, posname: "ERP pos", statusname: "Хүлээн авсан" });
        return env(true);
      }
    }

    const save = SAVES[endpoint];
    if (save) {
      const rows = save.batch ? (Array.isArray(body) ? (body as Row[]) : []) : [body as Row];
      for (const row of rows) {
        const entryid = Number(row.entryid ?? 0);
        const list = L[save.list];
        if (entryid > 0) {
          const i = list.findIndex((r) => Number(r.entryid) === entryid);
          if (i < 0) return env(null, 1, "Мөр олдсонгүй.");
          list[i] = { ...list[i], ...row };
        } else {
          list.push({ ...row, entryid: this.id() });
        }
      }
      return env(true);
    }

    const del = ERP_DELETES[endpoint];
    if (del) {
      const raw = params.get(del.param);
      if (raw === null) return env(null, 1, `missing ${del.param}`); // wrong casing
      const list = L[del.list];
      const i = list.findIndex((r) => Number(r.entryid) === Number(raw));
      if (i < 0) return env(null, 1, "Мөр олдсонгүй.");
      const [gone] = list.splice(i, 1);
      if (del.list === "requests") {
        this.recruitmentorders = this.recruitmentorders.filter((o) => Number(o.recruitmentorderid) !== Number(gone.recruitmentorderid));
      }
      return env(true);
    }
    return env(null, 1, `unknown endpoint ${endpoint}`);
  }
}

function env(retdata: unknown, rettype = 0, retmsg = "") {
  return new Response(JSON.stringify({ rettype, retmsg, retdata }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function readBody(init?: RequestInit): Promise<unknown> {
  const b = init?.body;
  if (b === undefined || b === null) return null;
  if (typeof b === "string") {
    try {
      return JSON.parse(b);
    } catch {
      return b;
    }
  }
  if (b instanceof FormData) {
    for (const value of b.values()) {
      if (value instanceof Blob) {
        const name = value instanceof File ? value.name : "blob";
        return { filename: name, bytes: Buffer.from(await value.arrayBuffer()).toString("base64") };
      }
    }
    return null;
  }
  return b;
}
