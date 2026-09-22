import { mimeFromName } from "@/lib/file-type";

/**
 * `GET /api/me/cv` — the stored CV as a file download. The ERP has no download
 * endpoint (Postman 04: its `get` carries the whole file as base64 `filedata`);
 * `/api/me/get` sends only `filename`, so a session load stays light, and the
 * bytes are fetched from here when the applicant asks for them.
 */

export const CV_MISSING_MESSAGE = "CV хавсаргаагүй байна.";

/** RFC 6266 / 5987: an ASCII fallback plus the exact UTF-8 name (Cyrillic file names). */
export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_") || "cv";
  const exact = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${exact}`;
}

export function cvResponse(cv: { filename: string; data: string }): Response {
  const bytes = Buffer.from(cv.data, "base64");
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mimeFromName(cv.filename),
      "Content-Length": String(bytes.length),
      "Content-Disposition": contentDisposition(cv.filename),
      // The applicant's own document: never cached by a shared cache, never sniffed.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
