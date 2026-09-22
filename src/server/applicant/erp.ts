import "server-only";

import { mimeFromName } from "@/lib/file-type";

/**
 * Server-side calls to the live ERP (careers.shunkhlai.mn), used only to push
 * an application (see `erp-push.ts`). Restored and trimmed from the retired
 * `src/server/erp/client.ts`: no stored tokens — each push batch logs in with
 * the applicant's регистр + phone from their D1 profile (registering them
 * first when the ERP does not know them yet; see `loginFor`).
 *
 * Every call has a timeout. Errors carry an endpoint and HTTP status for
 * logging; never log the request payload, the credentials or the token.
 */

const TIMEOUT_MS = 10_000;

const erpBase = () => process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ?? "";
const origin = () => process.env.NEXT_PUBLIC_ORIGIN_URL?.trim() || erpBase();
const language = () => process.env.NEXT_PUBLIC_API_LANGUAGE?.trim() || "MN";

/** False in mock mode (no `NEXT_PUBLIC_API_URL`): nothing is pushed. */
export const hasErp = () => erpBase().length > 0;

export class ErpError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status?: number,
    readonly rettype?: number,
  ) {
    super(message);
    this.name = "ErpError";
  }
}

function headers(token?: string, json = true): Record<string, string> {
  const h: Record<string, string> = { Origin: origin(), language: language() };
  if (json) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

type Envelope<T> = { rettype?: number; retmsg?: string; retdata?: T };

async function call<T>(endpoint: string, init: RequestInit, query = ""): Promise<T> {
  // A plain timer (not AbortSignal.timeout) so the limit also covers reading
  // the body, and so tests with fake timers can drive it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  let body: Envelope<T> | null;
  try {
    res = await fetch(`${erpBase()}/api/applicant/${endpoint}${query}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    body = (await res.json().catch(() => null)) as Envelope<T> | null;
  } catch {
    throw new ErpError(controller.signal.aborted ? "timeout" : "network", endpoint);
  } finally {
    clearTimeout(timer);
  }
  if (body && typeof body === "object" && "rettype" in body) {
    if (body.rettype !== 0) {
      throw new ErpError(body.retmsg || "erp_error", endpoint, res.status, body.rettype);
    }
    return body.retdata as T;
  }
  if (!res.ok) throw new ErpError(`http_${res.status}`, endpoint, res.status);
  return body as unknown as T;
}

/** `auth/login` → the access token. Throws `ErpError` on wrong credentials. */
export async function erpLogin(regno: string, phone: string): Promise<string> {
  const data = await call<{ access_token?: string } | null>("auth/login", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ regNo: regno, mobile: phone }),
  });
  if (!data?.access_token) throw new ErpError("no_token", "auth/login");
  return data.access_token;
}

/**
 * `SaveHrAppUser` (Postman 01/02) → the access token, in `retdata.access_token`.
 * A new регистр creates the ERP applicant; an existing one only logs in when
 * `mobilephone` (the password) matches, else "…зөрж байна!" (thrown as
 * `ErpError`). No auth header.
 */
export async function erpRegister(input: {
  lastname: string;
  firstname: string;
  regno: string;
  email: string;
  mobilephone: string;
}): Promise<string> {
  const data = await call<{ access_token?: string } | null>("SaveHrAppUser", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!data?.access_token) throw new ErpError("no_token", "SaveHrAppUser");
  return data.access_token;
}

export function erpGet<T>(endpoint: string, token: string, query = ""): Promise<T> {
  return call<T>(endpoint, { headers: headers(token) }, query);
}

export function erpPost<T>(
  endpoint: string,
  token: string,
  payload?: unknown,
  query = "",
): Promise<T> {
  return call<T>(
    endpoint,
    {
      method: "POST",
      headers: headers(token),
      body: payload === undefined ? undefined : JSON.stringify(payload),
    },
    query,
  );
}

/**
 * Multipart upload under the field name the browser client uses (`file`),
 * typed from the file name so the ERP does not keep the CV as octet-stream.
 */
export function erpUpload<T>(
  endpoint: string,
  token: string,
  file: { filename: string; base64: string },
): Promise<T> {
  const form = new FormData();
  const blob = new Blob([Buffer.from(file.base64, "base64")], { type: mimeFromName(file.filename) });
  form.append("file", blob, file.filename);
  return call<T>(endpoint, { method: "POST", headers: headers(token, false), body: form });
}
