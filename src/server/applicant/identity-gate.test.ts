import { describe, expect, it } from "vitest";

import { IDENTITY_REQUIRED_MESSAGE, REGNO_LOCKED_MESSAGE } from "@/lib/applicant-identity";
import type { ApplicantDoc, Row } from "./handlers";
import { identityGate } from "./identity-gate";

const FULL = { regno: "УБ99010101", lastname: "Дорж", firstname: "Бат", mobilephone: "99112233" };

function doc(profile: Row, erp?: ApplicantDoc["erp"]): ApplicantDoc {
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
    erp,
  };
}

describe("identityGate", () => {
  it("never gates a GET", () => {
    expect(identityGate("get", "GET", doc({}), null)).toBeNull();
  });

  it("gates every other POST on the STORED profile, whatever the body says", () => {
    for (const key of Object.keys(FULL)) {
      const profile = { ...FULL, [key]: " " };
      expect(identityGate("SaveHrAppEducation", "POST", doc(profile), FULL)).toBe(IDENTITY_REQUIRED_MESSAGE);
    }
    expect(identityGate("SaveAppCV", "POST", doc(FULL), null)).toBeNull();
  });

  it("SaveHrApplicant: judged on stored ⊕ body; an omitted key keeps the stored value", () => {
    expect(identityGate("SaveHrApplicant", "POST", doc({}), FULL)).toBeNull();
    expect(identityGate("SaveHrApplicant", "POST", doc(FULL), { addr2: "x" })).toBeNull();
    expect(identityGate("SaveHrApplicant", "POST", doc(FULL), { firstname: "" })).toBe(IDENTITY_REQUIRED_MESSAGE);
    expect(identityGate("SaveHrApplicant", "POST", doc({ ...FULL, regno: "" }), { addr2: "x" })).toBe(
      IDENTITY_REQUIRED_MESSAGE,
    );
    expect(identityGate("SaveHrApplicant", "POST", doc({}), null)).toBe(IDENTITY_REQUIRED_MESSAGE);
  });

  it("after the ERP link the регистр is fixed; case/space differences are the same регистр", () => {
    const linked = doc(FULL, { pulledAt: "2026-09-22T00:00:00Z" });
    expect(identityGate("SaveHrApplicant", "POST", linked, { regno: "АА00000000" })).toBe(REGNO_LOCKED_MESSAGE);
    expect(identityGate("SaveHrApplicant", "POST", linked, { regno: " уб99010101 " })).toBeNull();
    expect(identityGate("SaveHrApplicant", "POST", linked, { mobilephone: "88112233" })).toBeNull();
    // Linked at the first token (before any pull): the linked регистр is what counts.
    const registered = doc({ ...FULL, regno: "АА00000000" }, { linkedRegno: "АА00000000" });
    expect(identityGate("SaveHrApplicant", "POST", registered, { regno: "УБ99010101" })).toBe(REGNO_LOCKED_MESSAGE);
    expect(identityGate("SaveHrApplicant", "POST", registered, { addr2: "x" })).toBeNull();
    // Not linked yet: a typo in the регистр can still be fixed.
    expect(identityGate("SaveHrApplicant", "POST", doc(FULL), { regno: "АА00000000" })).toBeNull();
  });
});
