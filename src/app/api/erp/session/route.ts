import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  ErpCredentialsUnreadableError,
  getLink,
  getValidErpToken,
} from "@/server/erp/link";

/**
 * Bridge: hands the signed-in Clerk user their current ERP access token.
 *
 * This lets the existing client-side account UI (which reads a token from
 * localStorage) work for Clerk users, without rewriting every call. The token
 * is minted/refreshed server-side from the encrypted creds; the user's
 * regno/phone never leave the server. (The short-lived access token in the
 * browser matches the app's existing, accepted localStorage model — and is
 * strictly better than today, where the phone-as-password lived there too.)
 *
 * Responses:
 *   401 — not signed in to Clerk
 *   409 — signed in but not linked yet (send them to /link); also
 *         `{ linked: false, reason: "relink" }` when the stored creds are
 *         unreadable and the user must re-link
 *   502 — `{ error: "erp_unavailable" }` for any other failure
 *   200 — { accessToken }
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const link = await getLink(userId);
  if (!link || link.status !== "linked") {
    return NextResponse.json({ linked: false }, { status: 409 });
  }

  try {
    const accessToken = await getValidErpToken(userId);
    return NextResponse.json({ linked: true, accessToken });
  } catch (e) {
    if (e instanceof ErpCredentialsUnreadableError) {
      return NextResponse.json({ linked: false, reason: "relink" }, { status: 409 });
    }
    console.error("[erp/session] token refresh failed", e);
    return NextResponse.json({ error: "erp_unavailable" }, { status: 502 });
  }
}
