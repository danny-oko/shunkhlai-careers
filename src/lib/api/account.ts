import { APPLICANT_BASE } from "./core/config";
import { apiPost } from "./core/request";

/**
 * Credential changes. Registration and sign-in live in `auth.ts`, since the
 * collection serves both from `SaveHrAppUser`.
 */

export type ChangeUserInfoInput = {
  phonenumber?: string;
  email?: string;
  oldpassword?: string;
  newpassword?: string;
  type: "PASSWORD" | "PHONE" | "EMAIL";
};

/** POST /api/applicant/changeUserInfo */
export function changeUserInfo(body: ChangeUserInfoInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/changeUserInfo`, body);
}

export function changePhone(phonenumber: string) {
  return changeUserInfo({ type: "PHONE", phonenumber });
}

export function changeEmail(email: string) {
  return changeUserInfo({ type: "EMAIL", email });
}
