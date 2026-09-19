import "server-only";

/**
 * Server-side ERP calls (careers.shunkhlai.mn).
 *
 * Distinct from `src/lib/api/**`, which is the browser client that keeps its
 * token in localStorage. Here the app acts on the user's behalf: it holds the
 * ERP token server-side (in `applicant_link`) and never exposes the user's
 * regno/phone/token to the browser.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ?? "";
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN_URL?.trim() || BASE;
const LANGUAGE = process.env.NEXT_PUBLIC_API_LANGUAGE?.trim() || "MN";

export class ErpError extends Error {
  constructor(
    message: string,
    readonly rettype?: number,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ErpError";
  }
}

export type ErpSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null; // epoch ms (from JWT `exp`)
  appId: string | null; // JWT `sub`
};

function baseHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: ORIGIN,
    language: LANGUAGE,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function decodeClaims(jwt: string): { exp?: number; sub?: string } {
  try {
    const payload = jwt.split(".")[1] ?? "";
    const json = Buffer.from(
      payload.replaceAll("-", "+").replaceAll("_", "/"),
      "base64",
    ).toString("utf8");
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export async function erpLogin(
  regno: string,
  phone: string,
): Promise<ErpSession> {
  if (!BASE) throw new ErpError("NEXT_PUBLIC_API_URL is not set");
  const res = await fetch(`${BASE}/api/applicant/auth/login`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ regNo: regno, mobile: phone }),
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    rettype?: number;
    retmsg?: string;
  } | null;

  if (!res.ok || !data?.access_token) {
    throw new ErpError(
      data?.retmsg || "Нэвтрэх амжилтгүй боллоо.",
      data?.rettype,
      res.status,
    );
  }
  const claims = decodeClaims(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: typeof claims.exp === "number" ? claims.exp * 1000 : null,
    appId: claims.sub ?? null,
  };
}

function unwrap<T>(
  body: { rettype?: number; retmsg?: string; retdata?: T } | null,
): T {
  if (body && typeof body === "object" && "rettype" in body) {
    if (body.rettype !== 0)
      throw new ErpError(body.retmsg || "ERP алдаа", body.rettype);
    return body.retdata as T;
  }
  return body as unknown as T;
}

export async function erpGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: baseHeaders(token) });
  const body = await res.json().catch(() => null);
  if (!res.ok && (!body || !("rettype" in body))) {
    throw new ErpError(
      `ERP GET ${path} failed (${res.status})`,
      undefined,
      res.status,
    );
  }
  return unwrap<T>(body);
}

export async function erpPost<T>(
  path: string,
  token: string,
  payload: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: baseHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok && (!body || !("rettype" in body))) {
    throw new ErpError(
      `ERP POST ${path} failed (${res.status})`,
      undefined,
      res.status,
    );
  }
  return unwrap<T>(body);
}
