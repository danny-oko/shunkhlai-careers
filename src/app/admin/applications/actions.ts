"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/server/admin/guard";
import {
  type StuckApplication,
  listStuckApplications,
  retryApplication,
  sweepStuckApplications,
} from "@/server/applicant/stuck";

/**
 * The stuck-application desk's server actions.
 *
 * `requireAdmin()` is the first statement in each one, for the reason spelled
 * out in `../news/actions.ts`: a server action is a POST to an endpoint the
 * browser knows the id of, and the layout above it never runs for a POST. A
 * function here that trusted the layout would be an unauthenticated way to
 * push a stranger's application into the ERP.
 *
 * Nothing in this file ever hands an upstream message to the browser: the rows
 * carry classified codes (`erp-retry.ts`), and the Mongolian wording is chosen
 * from those codes in `stuck-labels.ts`.
 */

export type DeskState = { message?: string; tone?: "ok" | "error" };

export async function loadStuckApplications(): Promise<StuckApplication[]> {
  await requireAdmin();
  return listStuckApplications();
}

/** Hands one application back to the sync, then refreshes the desk. */
export async function retryApplicationAction(
  _previous: DeskState,
  formData: FormData,
): Promise<DeskState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const entryid = Number(formData.get("entryid"));
  if (!email || !Number.isFinite(entryid)) {
    return { tone: "error", message: "Хүсэлт олдсонгүй." };
  }

  try {
    const result = await retryApplication(email, entryid);
    revalidatePath("/admin/applications");
    if (result.ok) return { tone: "ok", message: "Дахин илгээхээр тавилаа." };
    return {
      tone: "error",
      message:
        result.reason === "conflict"
          ? "Энэ хүсэлтийг өөр газраас яг одоо хөндөж байна. Хэсэг хүлээгээд дахин оролдоно уу."
          : "Хүсэлт олдсонгүй.",
    };
  } catch (error) {
    // The database or the sync fell over. The row is untouched and still on
    // the desk; the admin sees that, not a 500.
    console.error("[admin-applications]", "retry_failed", String(error));
    return { tone: "error", message: "Дахин илгээж чадсангүй. Дараа дахин оролдоно уу." };
  }
}

/** Runs one bounded sweep by hand (the same one a cron tick would run). */
export async function sweepAction(_previous: DeskState): Promise<DeskState> {
  await requireAdmin();
  try {
    const report = await sweepStuckApplications();
    revalidatePath("/admin/applications");
    return { tone: "ok", message: `${report.claimed} хүсэлтийг дахин илгээхээр эхлүүллээ.` };
  } catch (error) {
    console.error("[admin-applications]", "sweep_failed", String(error));
    return { tone: "error", message: "Шалгалт ажиллуулж чадсангүй." };
  }
}
