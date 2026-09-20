import { describe, expect, it } from "vitest";

import { buildProfilePayload, unwrapProfile, type ApplicantProfile, type ProfileInput } from "./profile";

const input: ProfileInput = {
  lastname: "Test",
  firstname: "User",
  regno: "AA00000000",
  mobilephone: "99000000",
  countryid: 29,
  divisionid: 1,
  districtid: 2,
  relativeid: 3,
  relativeid2: null,
  addr2: "",
  isa: false,
  isb: true,
  isc: false,
  isd: false,
  ise: false,
  custom1: "",
  custom2: "text",
};

describe("buildProfilePayload", () => {
  it("omits null numeric ids instead of sending null", () => {
    const payload = buildProfilePayload(input);
    expect("relativeid2" in payload).toBe(false);
    expect(payload.relativeid).toBe(3);
  });

  it("omits empty-string ids and null relativeid", () => {
    const payload = buildProfilePayload({
      ...input,
      relativeid: null,
      countryid: null,
      districtid: "" as unknown as number,
    });
    for (const key of ["relativeid", "countryid", "districtid"]) {
      expect(key in payload).toBe(false);
    }
  });

  it("never sends a blank regno or mobilephone", () => {
    const payload = buildProfilePayload({ ...input, regno: " ", mobilephone: "" });
    expect("regno" in payload).toBe(false);
    expect("mobilephone" in payload).toBe(false);
  });

  it("keeps empty text and false licence flags (they are meaningful)", () => {
    const payload = buildProfilePayload(input);
    expect(payload.addr2).toBe("");
    expect(payload.custom1).toBe("");
    expect(payload.isa).toBe(false);
    expect(payload.isb).toBe(true);
    expect(payload.custom2).toBe("text");
  });

  it("echoes loaded keys the form does not own, edits win", () => {
    const loaded: ApplicantProfile = { somethingnew: "keep", email2: "old@x.mn", mobilephone: "1" };
    const payload = buildProfilePayload({ ...input, email2: "new@x.mn" }, loaded);
    expect(payload.somethingnew).toBe("keep");
    expect(payload.email2).toBe("new@x.mn");
    expect(payload.mobilephone).toBe("99000000");
  });

  it("does not echo derived, display-only or heavy keys", () => {
    const loaded: ApplicantProfile = {
      countryname: "Япон",
      divisionname: "x",
      districtname: "y",
      relativename: "z",
      picturedata: "AAAA",
      filedata: "BBBB",
      filename: "cv.pdf",
      totalper: 50,
      persinfoper: 10,
      maritalOptions: [{ key: "M", text: "Гэрлэсэн" }],
    };
    const payload = buildProfilePayload(input, loaded);
    for (const key of Object.keys(loaded)) expect(key in payload).toBe(false);
  });

  it("drops a loaded null id (relativeid) rather than echoing it", () => {
    const loaded: ApplicantProfile = { relativeid2: null, custom1: null };
    const payload = buildProfilePayload({ ...input, relativeid2: undefined, custom1: undefined }, loaded);
    expect("relativeid2" in payload).toBe(false);
    expect("custom1" in payload).toBe(false);
  });
});

describe("unwrapProfile", () => {
  it("unwraps the real envelope and exposes the marital list", () => {
    const profile = unwrapProfile({
      applicantdata: [{ firstname: "A", isa: true }],
      recruitmentorders: [],
      maritalstatus: [{ key: "M", text: "Гэрлэсэн" }],
    });
    expect(profile.firstname).toBe("A");
    expect(profile.isa).toBe(true);
    expect(profile.maritalOptions).toEqual([{ key: "M", text: "Гэрлэсэн" }]);
  });

  it("passes a flat (mock) record through and tolerates nothing", () => {
    expect(unwrapProfile({ firstname: "B" }).firstname).toBe("B");
    expect(unwrapProfile(null)).toEqual({});
    expect(unwrapProfile({ applicantdata: [] }).firstname).toBeUndefined();
  });
});
