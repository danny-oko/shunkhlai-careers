import { describe, expect, it } from "vitest";

import {
  identityProblem,
  isIdentityComplete,
  missingIdentity,
  normalizePhone,
  normalizeRegno,
} from "./applicant-identity";

const FULL = { regno: "УБ99010101", lastname: "Дорж", firstname: "Бат", mobilephone: "99112233" };

describe("applicant identity", () => {
  it("lists the blank fields in form order", () => {
    expect(missingIdentity(null)).toEqual(["regno", "lastname", "firstname", "mobilephone"]);
    expect(missingIdentity({ ...FULL, firstname: "  ", mobilephone: null })).toEqual(["firstname", "mobilephone"]);
    expect(isIdentityComplete(FULL)).toBe(true);
  });

  it("names the first blank field in Mongolian", () => {
    expect(identityProblem({ ...FULL, lastname: "" })).toBe("«Овог» талбарыг бөглөнө үү.");
  });

  it("checks the регистр (2 Cyrillic letters + 8 digits) and phone formats of new values", () => {
    expect(identityProblem(FULL)).toBeNull();
    expect(identityProblem({ ...FULL, regno: "уб99010101" })).toBeNull(); // upper-cased on save
    expect(identityProblem({ ...FULL, regno: "UB99010101" })).toMatch(/^Регистрийн дугаар 2 кирилл/);
    expect(identityProblem({ ...FULL, regno: "УБ9901010" })).toMatch(/^Регистрийн дугаар/);
    expect(identityProblem({ ...FULL, mobilephone: "9911" })).toMatch(/^Утасны дугаараа/);
    expect(identityProblem({ ...FULL, mobilephone: "+976 9911 2233" })).toBeNull();
  });

  it("does not re-check a value the ERP already holds", () => {
    const saved = { ...FULL, regno: "ЖИ12345", mobilephone: "123" };
    expect(identityProblem({ ...FULL, regno: "ЖИ12345", mobilephone: "123" }, saved)).toBeNull();
  });

  it("normalises a phone to its 8 digits and a регистр to trimmed upper case", () => {
    for (const raw of ["99112233", " 9911 2233 ", "9911-2233", "+976 9911 2233", "976-99112233", "+97699112233"]) {
      expect(normalizePhone(raw)).toBe("99112233");
    }
    expect(normalizePhone(" 12ab ")).toBe("12ab"); // not a mobile: left as the ERP may hold it
    // 976 is only a country code with "+" or as the head of 11 digits.
    expect(normalizePhone("97611223")).toBe("97611223");
    expect(normalizePhone("976 1122 3344")).toBe("11223344");
    expect(normalizePhone("9761122334")).toBe("9761122334"); // 10 digits: not a mobile, left alone
    expect(normalizePhone(null)).toBe("");
    expect(normalizeRegno(" уб99010101 ")).toBe("УБ99010101");
    expect(identityProblem({ ...FULL, mobilephone: "9911 2233" }, FULL)).toBeNull();
  });
});
