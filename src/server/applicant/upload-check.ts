import { ACCEPTED_CV_EXTENSIONS, ACCEPTED_CV_TYPES } from "@/lib/apply-schema";

/**
 * `/api/me`'s server-side check of an uploaded file, the backstop for the
 * browser's (`describeCvFileError`, `resizePhoto`): a CV must have one of the
 * accepted extensions, and a reported MIME type must be an accepted one; a
 * photo must be JPEG, PNG or WebP by its first bytes. Returns the Mongolian
 * refusal, or null when the file may be stored.
 */

export const CV_TYPE_MESSAGE = "PDF, DOC эсвэл DOCX файл оруулна уу.";
export const PICTURE_TYPE_MESSAGE = "Зураг оруулна уу (JPG, PNG).";

/** What a browser sends when it does not know the type — no claim either way. */
const UNKNOWN_TYPES = new Set(["", "application/octet-stream"]);

const PICTURE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Upload = { name: string; type?: string; data: string };

function cvProblem({ name, type = "" }: Upload): string | null {
  const lower = name.trim().toLowerCase();
  if (!ACCEPTED_CV_EXTENSIONS.some((ext) => lower.endsWith(ext))) return CV_TYPE_MESSAGE;
  const mime = type.split(";")[0].trim().toLowerCase();
  if (!UNKNOWN_TYPES.has(mime) && !ACCEPTED_CV_TYPES.includes(mime)) return CV_TYPE_MESSAGE;
  return null;
}

/** JPEG FF D8 FF, PNG 89 50 4E 47, WebP "RIFF" … "WEBP". */
function isImage(bytes: Buffer): boolean {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return true;
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  );
}

function pictureProblem({ type = "", data }: Upload): string | null {
  const mime = type.split(";")[0].trim().toLowerCase();
  if (!UNKNOWN_TYPES.has(mime) && !PICTURE_TYPES.has(mime)) return PICTURE_TYPE_MESSAGE;
  // Only the first 12 bytes are needed: 16 base64 characters.
  return isImage(Buffer.from(data.slice(0, 16), "base64")) ? null : PICTURE_TYPE_MESSAGE;
}

export function uploadProblem(endpoint: string, upload: Upload): string | null {
  if (endpoint === "SaveAppCV") return cvProblem(upload);
  if (endpoint === "SaveAppPicture") return pictureProblem(upload);
  return null;
}
