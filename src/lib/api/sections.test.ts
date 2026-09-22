import axios, { type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";

import { http } from "./core/client";
import { education, language } from "./sections";

/**
 * Боловсрол on the wire, as the Postman folder spells it: one row by
 * GetHrAppEducation with `entryid`, delete by DeleteHrAppEducation with
 * `ENTRYID` in capitals — the id in the query string rather than a body.
 */

const ENVELOPE = { totalrow: 0, affectedrows: 1, retmsg: "", traceno: 0, rettype: 0 };

type Seen = { url: string; method?: string; data?: unknown };

function recording(seen: Seen[], retdata: unknown = true): AxiosAdapter {
  return async (config) => {
    seen.push({ url: axios.getUri(config), method: config.method, data: config.data });
    return { status: 200, statusText: "OK", headers: {}, config, data: { ...ENVELOPE, retdata } };
  };
}

afterEach(() => {
  delete http.defaults.adapter;
});

describe("education", () => {
  it("get reads one row by entryid", async () => {
    const seen: Seen[] = [];
    http.defaults.adapter = recording(seen, { entryid: 7, universitynametext: "Мандах академи" });
    expect(await education.get(7)).toEqual({ entryid: 7, universitynametext: "Мандах академи" });
    expect(seen[0].url).toMatch(/\/api\/me\/GetHrAppEducation\?entryid=7$/);
  });

  it("get with entryid 0 asks nothing (the collection: 0 comes back empty)", async () => {
    const seen: Seen[] = [];
    http.defaults.adapter = recording(seen);
    expect(await education.get(0)).toBeNull();
    expect(seen).toEqual([]);
  });

  it("remove sends ENTRYID in the query string, no body", async () => {
    const seen: Seen[] = [];
    http.defaults.adapter = recording(seen);
    await education.remove(11);
    expect(seen[0].method).toBe("post");
    expect(seen[0].url).toMatch(/\/api\/me\/DeleteHrAppEducation\?ENTRYID=11$/);
    expect(seen[0].data).toBeUndefined();
  });
});

describe("language", () => {
  it("save posts the Postman body as is: ids and studytime numbers, score text", async () => {
    const seen: Seen[] = [];
    http.defaults.adapter = recording(seen, { entryid: 9 });
    const body = {
      entryid: 0,
      forlanguageid: 15,
      studytime: 5,
      listeninglevelid: 4,
      speakinglevelid: 4,
      readinglevelid: 6,
      writinglevelid: 0,
      score: "IELTS 6.5",
    };
    await language.save(body);
    expect(seen[0].method).toBe("post");
    expect(seen[0].url).toMatch(/\/api\/me\/SaveAppForLanguage$/);
    expect(JSON.parse(String(seen[0].data))).toEqual(body);
  });

  it("get reads one row by entryid", async () => {
    const seen: Seen[] = [];
    http.defaults.adapter = recording(seen, { entryid: 9, studytime: 5 });
    expect(await language.get(9)).toEqual({ entryid: 9, studytime: 5 });
    expect(seen[0].url).toMatch(/\/api\/me\/GetAppForLanguage\?entryid=9$/);
  });

  it("remove sends lowercase entryid in the query string, no body", async () => {
    const seen: Seen[] = [];
    http.defaults.adapter = recording(seen);
    await language.remove(9);
    expect(seen[0].method).toBe("post");
    expect(seen[0].url).toMatch(/\/api\/me\/DeleteAppForLanguage\?entryid=9$/);
    expect(seen[0].data).toBeUndefined();
  });
});
