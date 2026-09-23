import axios, { type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";

import { http } from "./core/client";
import * as jobs from "./jobs";

/**
 * How the posting list asks its question.
 *
 * The three filter parameters are spelled in the collection as
 * `jobName`, `locationid` and `salaryLevelID` — three different casings, one
 * of which (`salaryLevelID`) is a capital `ID` the eye skips over. A silent
 * rename to `salarylevelid` would not fail anywhere: the backend would simply
 * stop filtering, and the page would look like it worked.
 */

const ENVELOPE = { totalrow: 0, affectedrows: 0, retmsg: "", traceno: 0, rettype: 0 };

function recording(seen: string[]): AxiosAdapter {
  return async (config) => {
    seen.push(axios.getUri(config));
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      data: { ...ENVELOPE, retdata: [] },
    };
  };
}

afterEach(() => {
  delete http.defaults.adapter;
});

describe("listOrders", () => {
  it("sends the three filters under the collection's casing", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen);

    await jobs.listOrders({ jobName: "нягтлан", locationid: 3, salaryLevelID: 6 });

    const query = decodeURIComponent(seen[0]);
    expect(query).toContain("getRecruitmentOrderList");
    expect(query).toContain("jobName=нягтлан");
    expect(query).toContain("locationid=3");
    expect(query).toContain("salaryLevelID=6");
  });

  it("defaults to the collection's 'everything' query", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen);

    await jobs.listOrders();

    // Exactly what the saved request sends, blanks included. Assembled from
    // the three names so the whole query string is not one opaque literal.
    const blanks = ["jobName=", "locationid=0", "salaryLevelID="].join("&");
    expect(seen[0]).toContain(blanks);
  });
});
