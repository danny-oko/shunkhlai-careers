import axios, { type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";

import { http } from "./core/client";
import * as reference from "./reference";

/**
 * How a dropdown asks its question.
 *
 * Two of the three shared parameters had no caller at all until the lists grew
 * a search box: `search` narrows 1463 job titles server-side, and `ids` names
 * the rows the answer must contain regardless, so a university saved months
 * ago still renders with its name once the list is no longer loaded whole.
 *
 * The wire format is the point here rather than the rows. The collection spells
 * a repeated parameter `ids=1&ids=2`; axios writes arrays as `ids[]=1&ids[]=2`
 * unless told otherwise, and a backend reading `ids` would have seen nothing
 * under a name it does not have. Nothing passed an array before, so the
 * default had never been wrong in practice — which is exactly why it needs a
 * test rather than a reader's attention.
 */

const ENVELOPE = { totalrow: 0, affectedrows: 0, retmsg: "", traceno: 0, rettype: 0 };

/**
 * Records the URL each call would have gone to, and answers with `rows`.
 *
 * `getUri` is what builds it — asking axios to serialise the parameters the
 * same way it would on the way out is the whole point, rather than rebuilding
 * a query string the test believes in.
 */
function recording(seen: string[], rows: Array<Record<string, unknown>> = []): AxiosAdapter {
  return async (config) => {
    seen.push(axios.getUri(config));

    return {
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      data: { ...ENVELOPE, affectedrows: rows.length, retdata: rows },
    };
  };
}

afterEach(() => {
  delete http.defaults.adapter;
});

describe("ids", () => {
  it("repeats the key instead of bracketing it", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen);

    await reference.universities({ ids: [67, 68], countryid: 496 });

    expect(seen[0]).toContain("ids=67&ids=68");
    expect(seen[0]).not.toContain("ids%5B%5D");
    expect(seen[0]).toContain("countryid=496");
  });

  it("resolves a saved value to its label", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen, [{ key: 67, text: "МУИС-МХСС", row_index: 1 }]);

    const [option] = await reference.universities({ ids: ["67"], countryid: 496 });

    expect(option).toEqual({
      value: "67",
      label: "МУИС-МХСС",
      raw: { key: 67, text: "МУИС-МХСС", row_index: 1 },
    });
  });

  it("sends a single id as a bare value", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen);

    await reference.jobTitles({ ids: 8477 });

    expect(seen[0]).toContain("ids=8477");
    expect(seen[0]).not.toContain("ids%5B%5D");
  });
});

describe("search", () => {
  it("goes to the server rather than filtering what arrived", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen);

    await reference.jobTitles({ search: "менежер" });

    expect(seen[0]).toContain(`search=${encodeURIComponent("менежер")}`);
  });

  it("sends search and lfr but omits an empty ids, which the server rejects with a 400", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen);

    await reference.countries();

    expect(seen[0]).toContain("search=");
    expect(seen[0]).toContain("lfr=false");
    expect(seen[0]).not.toContain("ids=");
  });

  it("omits an empty array of ids too, and keeps a numeric 0 parent", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen);

    await reference.universities({ ids: [], countryid: 0 });

    expect(seen[0]).not.toContain("ids");
    expect(seen[0]).toContain("countryid=0");
  });

  it("omits lfr and ids for the three endpoints that take search alone", async () => {
    const seen: string[] = [];
    http.defaults.adapter = recording(seen);

    await reference.positions({ search: "инженер" });

    expect(seen[0]).not.toContain("lfr=");
    expect(seen[0]).not.toContain("ids=");
  });
});

describe("rows", () => {
  it("trims the labels the backend leaves padded", async () => {
    // The collection's own example carries "\tLeipzig" and " Gangwon-do".
    http.defaults.adapter = recording([], [{ key: 2021, text: "\tLeipzig" }]);

    const [option] = await reference.divisions({ countryid: 4 });

    expect(option.label).toBe("Leipzig");
  });

  it("keeps the untouched row, so positions can be filtered on posgroupid", async () => {
    http.defaults.adapter = recording(
      [],
      [{ key: 3738, text: "/10406/ Business Development Specialist", depid: "2771", posgroupid: 122 }],
    );

    const [option] = await reference.positions({});

    expect(option.raw.posgroupid).toBe(122);
    expect(option.raw.depid).toBe("2771");
  });
});
