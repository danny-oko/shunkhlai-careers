/**
 * The MIME type of an uploaded file, from its name's extension — how the
 * Postman collection (04. CV) says to read back a stored CV, which comes with
 * a `filename` and base64 `filedata` only. Shared by the ERP upload (so the
 * multipart part is not `application/octet-stream`) and the `/api/me/cv`
 * download.
 */

const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export const FALLBACK_MIME = "application/octet-stream";

export function mimeFromName(filename: string | null | undefined): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename?.trim() ?? "");
  return (match && BY_EXTENSION[match[1].toLowerCase()]) || FALLBACK_MIME;
}
