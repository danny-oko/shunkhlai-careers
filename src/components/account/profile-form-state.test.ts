import { describe, expect, it } from "vitest";

import { missingRequired, toInput, toState } from "./profile-form-state";

const complete = toState({
  regno: "УБ99010101",
  lastname: "Дорж",
  firstname: "Бат",
  mobilephone: "99112233",
  email2: "bat@x.mn",
  countryid: 28,
  divisionid: 1,
  districtid: 11,
  addr2: "УБ",
  contactname: "Дорж",
  relativeid: 1,
  contactphone: "99220022",
});

describe("profile form required fields", () => {
  it("requires регистр, овог, нэр, утас before anything else", () => {
    expect(missingRequired(complete)).toBeNull();
    expect(missingRequired({ ...complete, regno: "", email2: "" })).toBe("«Регистрийн дугаар» талбарыг бөглөнө үү.");
    expect(missingRequired({ ...complete, firstname: " " })).toBe("«Нэр» талбарыг бөглөнө үү.");
    expect(missingRequired({ ...complete, email2: "" })).toBe("«Имэйл» талбарыг бөглөнө үү.");
  });

  it("validates a newly typed регистр and phone, not ones already saved", () => {
    expect(missingRequired({ ...complete, regno: "AB12345678" })).toMatch(/^Регистрийн дугаар 2 кирилл/);
    expect(missingRequired({ ...complete, mobilephone: "12" })).toMatch(/^Утасны дугаараа/);
    expect(missingRequired({ ...complete, mobilephone: "12" }, { mobilephone: "12" })).toBeNull();
  });

  it("sends регистр upper-cased and the phone as its 8 digits", () => {
    const input = toInput({ ...complete, regno: " уб99010101", mobilephone: "+976 9911-2233" });
    expect(input).toMatchObject({ regno: "УБ99010101", mobilephone: "99112233" });
  });
});
