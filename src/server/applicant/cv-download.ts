import { mimeFromName } from "@/lib/file-type";

/**
 * The stored CV as an HTTP response. The ERP has no download endpoint (Postman
 * 04: its `get` carries the whole file as base64 `filedata`); `/api/me/get`
 * sends only `filename`, so a session load stays light, and the bytes are
 * fetched when somebody asks for them.
 *
 * Two routes serve them, and they differ only in who they let in:
 * `GET /api/me/cv` gives the signed-in applicant their own file, and
 * `/admin/applications/<key>/file/cv` gives an `admin` the file of the
 * applicant whose application they are reading (`mayViewApplicantData`).
 */

export const CV_MISSING_MESSAGE = "CV хавсаргаагүй байна.";

/** RFC 6266 / 5987: an ASCII fallback plus the exact UTF-8 name (Cyrillic file names). */
export function contentDisposition(
  filename: string,
  disposition: "attachment" | "inline" = "attachment",
): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_") || "cv";
  const exact = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${exact}`;
}

/**
 * Whether this file may be shown in the browser instead of downloaded.
 *
 * PDF only, and from the extension the name carries rather than from anything
 * a request asked for. A `.doc` served `inline` is downloaded anyway, and
 * anything that is not one of the three accepted CV types
 * (`upload-check.ts`) resolves to `application/octet-stream` — neither is
 * worth the one case where a stored file's type is not what its name claims
 * and the browser is invited to render it in this site's own origin.
 */
export const canPreview = (filename: string): boolean =>
  mimeFromName(filename) === "application/pdf";

export function cvResponse(
  cv: { filename: string; data: string },
  { preview = false }: { preview?: boolean } = {},
): Response {
  const bytes = Buffer.from(cv.data, "base64");
  const inline = preview && canPreview(cv.filename);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mimeFromName(cv.filename),
      "Content-Length": String(bytes.length),
      "Content-Disposition": contentDisposition(cv.filename, inline ? "inline" : "attachment"),
      // The applicant's own document: never cached by a shared cache, never sniffed.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
