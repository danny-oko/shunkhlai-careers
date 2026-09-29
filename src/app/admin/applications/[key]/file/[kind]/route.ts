import { redirect } from "next/navigation";

import { currentAdmin, mayViewApplicantData } from "@/server/admin/guard";
import { readCv, readPicture } from "@/server/applicant/account-store";
import { resolveApplication } from "@/server/applicant/application-desk";
import { CV_MISSING_MESSAGE, cvResponse } from "@/server/applicant/cv-download";
import { parseDataUrl } from "@/server/files/data-url";

/**
 * The CV and the photo of the applicant whose application is open, for an
 * `admin` reading `/admin/applications/<key>`.
 *
 * ## The gate
 *
 * Checked here, not inherited. A route handler is a GET the browser knows the
 * URL of and no layout runs for it, so the page's own `requireAdminUser()`
 * protects nothing on this path: without the two checks below, the CV of every
 * applicant would be one guessable URL away. An `editor` is refused for the
 * reason in `mayViewApplicantData` — a role that may read the desk is not
 * thereby a role that may take an applicant's file off it.
 *
 * ## Addressed by the application's key
 *
 * The same address the detail page has, and for the same reason
 * (`application-desk.ts`): a URL ends up in chat, in a bookmark and in nginx's
 * access log, and an applicant's email address does not belong in any of them.
 * The key is an opaque hash; the account behind it is resolved on the server.
 *
 * ## What comes back
 *
 * The bytes, `private, no-store`, `nosniff`, and never a name or a type taken
 * from the request. A PDF may be shown in the browser (`?view=1` →
 * `Content-Disposition: inline`, and only for a PDF — see `canPreview`);
 * everything else is a download. The photo is always inline, and its type is
 * the one the store recorded when the upload was checked
 * (`upload-check.ts` — JPEG, PNG or WebP by its first bytes).
 */

export const dynamic = "force-dynamic";

const FORBIDDEN = "Нэр дэвшигчийн хувийн мэдээллийг харах эрх байхгүй байна.";
const NOT_FOUND = "Файл олдсонгүй.";
const FAILED = "Файлыг уншиж чадсангүй. Дараа дахин оролдоно уу.";
const PHOTO_MISSING = "Зураг байхгүй байна.";

/** Plain text, never cached: these are answers about somebody's file. */
const problem = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });

function photoResponse(picture: string): Response {
  const { contentType, base64 } = parseDataUrl(picture);
  const bytes = Buffer.from(base64, "base64");
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/admin/applications/[key]/file/[kind]">,
) {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  if (!mayViewApplicantData(user)) return problem(FORBIDDEN, 403);

  const { key, kind } = await ctx.params;
  if (kind !== "cv" && kind !== "photo") return problem(NOT_FOUND, 404);

  try {
    const target = await resolveApplication(key);
    if (!target) return problem(NOT_FOUND, 404);

    if (kind === "photo") {
      const picture = await readPicture(target.email);
      return picture ? photoResponse(picture) : problem(PHOTO_MISSING, 404);
    }

    const cv = await readCv(target.email);
    if (!cv?.data) return problem(CV_MISSING_MESSAGE, 404);
    return cvResponse(cv, { preview: new URL(request.url).searchParams.get("view") === "1" });
  } catch (error) {
    // `String(error)` rather than the error itself: a failure from the file
    // store must not carry a document's contents into the log.
    console.error("[admin/applications]", "file_read_failed", kind, String(error));
    return problem(FAILED, 500);
  }
}
