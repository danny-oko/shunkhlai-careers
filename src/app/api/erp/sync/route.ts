import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { syncProfile } from "@/server/erp/link";

/**
 * Re-mirrors the signed-in user's ERP profile into our D1 database. Called after
 * a save so our own copy stays current with what was written to the ERP.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    await syncProfile(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "error" },
      { status: 502 }
    );
  }
}
