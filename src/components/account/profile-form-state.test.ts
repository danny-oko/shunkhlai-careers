import { describe, expect, it } from "vitest";

import { maritalChoices, missingRequired, toInput, toState, withSavedChoice } from "./profile-form-state";

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

describe("saved choices", () => {
  const list = [{ value: "13", label: "Архангай" }];

  it("adds the loaded value with its stored label when the list lacks it", () => {
    expect(withSavedChoice(list, "70", { value: 70, label: "Барнаул" })).toEqual([...list, { value: "70", label: "Барнаул" }]);
    // No stored label: the value itself rather than a blank.
    expect(withSavedChoice([], "70", { value: 70 })).toEqual([{ value: "70", label: "70" }]);
  });

  it("adds nothing when the list has it, nothing is chosen, or another value is chosen", () => {
    expect(withSavedChoice(list, "13", { value: 13, label: "x" })).toBe(list);
    expect(withSavedChoice(list, "", { value: 70, label: "Барнаул" })).toBe(list);
    expect(withSavedChoice(list, "1", { value: 70, label: "Барнаул" })).toBe(list);
  });

  it("marital: the ERP's list first, the fallback otherwise, an unknown code as itself", () => {
    const erp = { maritalOptions: [{ key: "S", text: "Ганц бие" }], maritalstatus: "S" };
    expect(maritalChoices(erp, "S")).toEqual([{ value: "S", label: "Ганц бие" }]);
    expect(maritalChoices({ maritalstatus: "M" }, "M").map((c) => c.value)).toEqual(["M", "U", "W", "K"]);
    expect(maritalChoices({ maritalstatus: "S" }, "S").at(-1)).toEqual({ value: "S", label: "S" });
    // A fallback code the ERP list lacks keeps its fallback text.
    expect(maritalChoices({ ...erp, maritalstatus: "M" }, "M").at(-1)).toEqual({ value: "M", label: "Гэрлэсэн" });
  });
});
