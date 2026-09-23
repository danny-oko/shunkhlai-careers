/**
 * `data:` URLs, because that is the shape the applicant's profile photo has
 * always had.
 *
 * `/api/me/get` hands the browser `picture` as `data:image/jpeg;base64,…` and
 * the account UI puts that string straight into an `<img src>`. Moving the
 * bytes to disk must not change that contract, so the store splits the URL on
 * the way in (content type + bytes) and rebuilds it on the way out.
 *
 * Dependency-free: both the app and the one-off migration script
 * (`scripts/files/move-to-disk.ts`, which runs outside a Next build) use it.
 */

/** What the picker produces, and what a legacy row without a prefix is assumed to be. */
export const DEFAULT_PICTURE_TYPE = "image/jpeg";

export type DataUrlParts = { contentType: string; base64: string };

/**
 * Splits `data:<type>;base64,<payload>`.
 *
 * A string that is not a data URL is treated as bare base64 with the default
 * type: rows written by the legacy ERP import stored the payload alone, and
 * they have to keep reading back.
 */
export function parseDataUrl(value: string): DataUrlParts {
  const match = /^data:([^;,]*)(;base64)?,/.exec(value);
  if (!match) return { contentType: DEFAULT_PICTURE_TYPE, base64: value };
  return {
    contentType: match[1] || DEFAULT_PICTURE_TYPE,
    base64: value.slice(match[0].length),
  };
}

export function toDataUrl(contentType: string, base64: string): string {
  return `data:${contentType || DEFAULT_PICTURE_TYPE};base64,${base64}`;
}
