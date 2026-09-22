import axios, { type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";

import { http } from "./core/client";
import { education } from "./sections";

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
