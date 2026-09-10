import { APPLICANT_BASE } from "./core/config";
import { apiGet, apiPost } from "./core/request";

/**
 * Registration, one-time codes and credential changes — the endpoints an
 * applicant reaches *before* they have a session (plus `changeUserInfo`,
 * which needs one).
 */

export type RegistrationInput = {
  lastname: string;
  firstname: string;
  regno: string;
  email: string;
  mobilephone: string;
  password: string;
};

export type ChangeUserInfoInput = {
  phoneNumber?: string;
  email?: string;
  oldPassword?: string;
  newPassword?: string;
  type: "PASSWORD" | "PHONE" | "EMAIL";
};

export type PasswordResetInput = {
  regno: string;
  /** Delivery channel for the code the applicant just received. */
  radiovalue: "SMS" | "EMAIL";
  otpcode: number;
  newpass: string;
};

/** POST /api/applicant/SaveHrAppUser — creates the login. Auth: none. */
export function register(body: RegistrationInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveHrAppUser`, body, { skipAuth: true });
}

/** POST /api/applicant/ResetHrAppUser — same body as `register`. Auth: none. */
export function resetAccount(body: RegistrationInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/ResetHrAppUser`, body, { skipAuth: true });
}

/** POST /api/applicant/sendOTCode */
export function sendOtp(body: { mobilephone?: string; email?: string; regno?: string }) {
  return apiPost<unknown>(`${APPLICANT_BASE}/sendOTCode`, body, { skipAuth: true });
}

/** POST /api/applicant/checkOTCode */
export function verifyOtp(body: { otpcode: number | string; mobilephone?: string; regno?: string }) {
  return apiPost<unknown>(`${APPLICANT_BASE}/checkOTCode`, body, { skipAuth: true });
}

/** POST /api/applicant/passwordResetOTCode — the reset flow's own code. */
export function sendPasswordResetOtp(body: { regno: string; radiovalue?: "SMS" | "EMAIL" }) {
  return apiPost<unknown>(`${APPLICANT_BASE}/passwordResetOTCode`, body, { skipAuth: true });
}

/** POST /api/applicant/passwordReset */
export function resetPassword(body: PasswordResetInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/passwordReset`, body, { skipAuth: true });
}

/**
 * GET /api/applicant/getContactInfo — the phone/email on file for a register
 * number, shown masked before a reset code is sent.
 */
export function getContactInfo(regNo: string) {
  return apiGet<unknown>(`${APPLICANT_BASE}/getContactInfo`, { regNo }, { skipAuth: true });
}

/** POST /api/applicant/changeUserInfo — Auth: required. */
export function changeUserInfo(body: ChangeUserInfoInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/changeUserInfo`, body);
}
