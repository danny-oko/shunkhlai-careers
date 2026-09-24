import { createHash } from "node:crypto";

import { IMAGE_FORMATS, IMAGE_TYPES, LIMITS } from "@/lib/news/shared/limits";

/**
 * Signed image uploads to Cloudinary.
 *
 * Signed, and only signed. The alternative — an unsigned upload preset, which
 * is what most "upload from the browser" snippets use — is a public write
 * endpoint on the company's media account: anyone who reads the page source
 * has the cloud name and the preset, and can fill the account with whatever
 * they like. So the browser never talks to Cloudinary at all here. It posts
 * the file to `/admin/upload`, that route proves the caller is an admin, and
 * this module does the upload from the server with a signature built from
 * `CLOUDINARY_API_SECRET`.
 *
 * The secret therefore has to stay on this side. It is read from
 * `process.env` at call time (never a `NEXT_PUBLIC_*` name, which would be
 * compiled into the browser bundle), it is never part of what is sent — the
 * signature is a hash, and the hash is the only thing derived from it that
 * leaves this file — and it is never in a returned value or a thrown message.
 *
 * The signing below is Cloudinary's own scheme: the parameters that will be
 * sent, minus `file`, `api_key` and `resource_type`, sorted by name, joined
 * `k=v&k=v`, the secret appended, SHA-1, hex. Sorting is the part worth
 * testing — the server re-derives the same string from the parameters it
 * receives, so a different order is a different hash and a refused upload.
 */

/** Everything this app uploads lives under one folder in the account. */
export const MEDIA_ROOT = "shunhlai";

/** The two things an admin can upload a picture for. */
export const MEDIA_FOLDERS = {
  hero: `${MEDIA_ROOT}/hero`,
  news: `${MEDIA_ROOT}/news`,
} as const;

export type MediaFolder = keyof typeof MEDIA_FOLDERS;

export function isMediaFolder(value: string): value is MediaFolder {
  return Object.hasOwn(MEDIA_FOLDERS, value);
}

/* --- what may be uploaded ------------------------------------------------ */

export const UPLOAD_TYPE_ERROR = "Зураг JPEG, PNG, WebP эсвэл AVIF хэлбэртэй байна.";
export const UPLOAD_SIZE_ERROR = "Зураг 8MB-аас хөнгөн байна.";
export const UPLOAD_EMPTY_ERROR = "Зураг сонгоно уу.";
export const UPLOAD_FAILED_ERROR = "Зургийг байршуулж чадсангүй. Дахин оролдоно уу.";
export const UPLOAD_CONFIG_ERROR = "Зургийн сервер тохируулагдаагүй байна.";

/**
 * The repo's existing limits, not new ones: `IMAGE_TYPES` and
 * `LIMITS.imageBytes` from `src/lib/news/shared/limits.ts`, which is also
 * where the note lives about why SVG is not on the list (it is a document
 * that can carry script).
 *
 * Checked on the server even though the picker sets `accept=`: `accept` is a
 * filter in a file dialog, not a rule, and this is reachable by anyone who
 * can post to the route.
 */
export function uploadProblem(file: { type: string; size: number }): string | null {
  if (file.size <= 0) return UPLOAD_EMPTY_ERROR;
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) return UPLOAD_TYPE_ERROR;
  if (file.size > LIMITS.imageBytes) return UPLOAD_SIZE_ERROR;
  return null;
}

/* --- signing ------------------------------------------------------------- */

export type SignedParams = Record<string, string | number>;

/**
 * The exact string that gets hashed, without the secret on the end.
 *
 * Split out from `signUpload` so it can be asserted on directly: this is the
 * whole of the scheme, and it is pure — same parameters in, same string out,
 * no clock and no environment.
 *
 * Empty values are dropped rather than sent as `k=`, which is what Cloudinary
 * does when it re-derives the signature; sending one would produce a hash the
 * server cannot reproduce.
 */
export function signatureBase(params: SignedParams): string {
  return Object.entries(params)
    .filter(([, value]) => value !== "" && value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/**
 * The signature Cloudinary expects: SHA-1 of the sorted parameters with the
 * secret appended, in hex.
 *
 * SHA-1 because that is the algorithm the endpoint verifies with, not because
 * it was chosen for its strength. It is not protecting anything here that a
 * stronger hash would protect better: the signature only proves that whoever
 * built this request held the account's secret, and it is spent within the
 * `timestamp` window.
 */
export function signUpload(params: SignedParams, apiSecret: string): string {
  return createHash("sha1")
    .update(`${signatureBase(params)}${apiSecret}`)
    .digest("hex");
}

/**
 * The non-file fields of the multipart request.
 *
 * Note what is in here: the signed parameters, the *public* api key, and the
 * signature. The secret is not a field and never becomes one — it exists only
 * inside `signUpload`, folded into a hash.
 */
export function uploadFields(
  params: SignedParams,
  apiKey: string,
  signature: string,
): Record<string, string> {
  return Object.fromEntries([
    ...Object.entries(params).map(([key, value]) => [key, String(value)]),
    ["api_key", apiKey],
    ["signature", signature],
  ]);
}

/** The parameters an upload of ours signs, given the moment it happens. */
export function uploadParams(folder: MediaFolder, timestamp: number): SignedParams {
  return {
    // Cloudinary joins a list parameter with commas when it re-derives the
    // signature, so it is sent in exactly that form.
    "allowed_formats": IMAGE_FORMATS.join(","),
    folder: MEDIA_FOLDERS[folder],
    timestamp,
  };
}

/* --- the upload itself --------------------------------------------------- */

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

/**
 * The three variables, read on use rather than at import.
 *
 * Returns null instead of throwing when one is missing: a site without
 * Cloudinary configured should still build, still run, and still let an
 * editor paste an image URL by hand — only the upload button stops working,
 * and it says so.
 */
export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function cloudinaryConfigured(): boolean {
  return cloudinaryConfig() !== null;
}

export function uploadEndpoint(cloudName: string): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
}

export type UploadResult = { url: string } | { error: string };

/**
 * Uploads one validated image and answers with the URL to store.
 *
 * `secure_url` and not `url`: the http variant would be a mixed-content block
 * on a TLS page. Anything else in Cloudinary's response is dropped — the
 * database stores an address, and the rest of the payload is account detail
 * the page has no use for.
 *
 * Failures come back as a Mongolian message rather than an exception. The
 * caller is a route answering a fetch from a form, and there is nothing it
 * could do with a stack trace that it cannot do with a sentence; the detail
 * is logged server-side instead, where it does not reach the browser.
 */
export async function uploadImage(
  file: File,
  folder: MediaFolder,
  now: number = Date.now(),
): Promise<UploadResult> {
  const problem = uploadProblem(file);
  if (problem) return { error: problem };

  const config = cloudinaryConfig();
  if (!config) {
    console.error("[media] CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET are not all set");
    return { error: UPLOAD_CONFIG_ERROR };
  }

  const params = uploadParams(folder, Math.floor(now / 1000));
  const body = new FormData();
  for (const [key, value] of Object.entries(
    uploadFields(params, config.apiKey, signUpload(params, config.apiSecret)),
  )) {
    body.set(key, value);
  }
  body.set("file", file);

  let payload: unknown;
  try {
    const response = await fetch(uploadEndpoint(config.cloudName), { method: "POST", body });
    payload = await response.json();
    if (!response.ok) {
      // Cloudinary's own refusal — a bad signature, a format it would not
      // take. Logged, never forwarded: it can quote the request back.
      console.error("[media] Cloudinary refused the upload:", response.status, describe(payload));
      return { error: UPLOAD_FAILED_ERROR };
    }
  } catch (error) {
    console.error("[media] upload failed:", error instanceof Error ? error.message : error);
    return { error: UPLOAD_FAILED_ERROR };
  }

  const url = secureUrl(payload);
  if (!url) {
    console.error("[media] upload returned no secure_url");
    return { error: UPLOAD_FAILED_ERROR };
  }
  return { url };
}

/** `secure_url`, if the response really carried an https one. */
function secureUrl(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value = (payload as { secure_url?: unknown }).secure_url;
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

/** The error message out of a Cloudinary error body, for the server log. */
function describe(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : "";
}
