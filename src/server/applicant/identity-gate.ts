import {
  IDENTITY_REQUIRED_MESSAGE,
  REGNO_LOCKED_MESSAGE,
  isIdentityComplete,
  normalizeRegno,
} from "@/lib/applicant-identity";
import { linkedRegno } from "./erp-model";
import type { ApplicantDoc, Row } from "./handlers";

/**
 * `/api/me` refuses every write until the applicant's регистр, овог, нэр and
 * утас are stored: those are what SaveHrAppUser needs to create or find the ERP
 * applicant, so nothing saved before them could ever reach the ERP. The one
 * write allowed is `SaveHrApplicant` itself, and only when the profile it
 * leaves behind has all four — judged on the merge the handler performs
 * (`{ ...stored, ...body }`), because the client leaves blank regno/phone out
 * of the body (`buildProfilePayload`).
 *
 * Once the account is linked to an ERP record (the first token, see
 * `markLinked`), the регистр is fixed: a different one would point the sync at
 * another person.
 *
 * Returns the Mongolian refusal, or null when the request may run.
 */
export function identityGate(
  endpoint: string,
  method: "GET" | "POST",
  doc: ApplicantDoc,
  body: unknown,
): string | null {
  if (method !== "POST") return null;
  if (endpoint !== "SaveHrApplicant") {
    return isIdentityComplete(doc.profile) ? null : IDENTITY_REQUIRED_MESSAGE;
  }
  const patch = body && typeof body === "object" && !Array.isArray(body) ? (body as Row) : {};
  const next = { ...doc.profile, ...patch };
  if (!isIdentityComplete(next)) return IDENTITY_REQUIRED_MESSAGE;
  const linked = linkedRegno(doc);
  if (linked && normalizeRegno(next.regno) !== linked) return REGNO_LOCKED_MESSAGE;
  return null;
}
