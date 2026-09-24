import { NextResponse } from "next/server";

import { isAdminRequest } from "@/server/admin/guard";
import {
  UPLOAD_EMPTY_ERROR,
  isMediaFolder,
  uploadImage,
} from "@/server/media/cloudinary";

/**
 * `POST /admin/upload` — one image, from an admin's browser to Cloudinary.
 *
 * A route and not a server action, for one reason: Next refuses a server
 * action body over 1MB (`serverActions.bodySizeLimit`) before the action
 * runs, which is why `cover-upload.ts` has to downscale a cover to 600KB
 * before the newsroom save can carry it. A route handler has no such cap, so
 * an 8MB photograph — the limit the rest of the app already uses — goes up
 * whole, and what comes back is a URL small enough to put in any form.
 *
 * Under `/admin` deliberately. The admin session cookie is scoped
 * `path=/admin` (see `adminCookieOptions`), so a route at `/api/...` would
 * not receive it and could not authenticate the caller at all.
 *
 * `isAdminRequest()` rather than `requireAdmin()`: this answers a `fetch`, and
 * a redirect to the login page is not something the uploader can do anything
 * with. The proxy has already turned unauthenticated navigations away; this
 * check is the one that counts, because a POST with a guessed URL does not
 * pass through a layout.
 */

function json(body: Record<string, unknown>, status: number): NextResponse {
  // Never cached, by anything: the answer is per-request and per-admin.
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isAdminRequest())) {
    return json({ error: "Нэвтэрнэ үү." }, 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // A body that is not multipart, or one cut off in flight.
    return json({ error: UPLOAD_EMPTY_ERROR }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: UPLOAD_EMPTY_ERROR }, 400);
  }

  // Which folder under `shunhlai/` this belongs in is the caller's to choose,
  // but only from the list — an arbitrary string here would let a signed
  // upload be filed anywhere in the account.
  const requested = String(form.get("folder") ?? "");
  const folder = isMediaFolder(requested) ? requested : "news";

  const result = await uploadImage(file, folder);
  // 422: the request was understood and refused on its content (wrong type,
  // too heavy), which is what the form shows under the picker.
  return "error" in result ? json({ error: result.error }, 422) : json({ url: result.url }, 200);
}
