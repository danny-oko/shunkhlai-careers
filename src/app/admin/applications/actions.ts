"use server";

import { revalidatePath } from "next/cache";

import { mayRetryApplications, requireAdminUser } from "@/server/admin/guard";
import { resolveApplication } from "@/server/applicant/application-desk";
import { retryApplication } from "@/server/applicant/stuck";

/**
 * The applications desk's one write.
 *
 * `requireAdminUser()` is the first statement, for the reason spelled out in
 * `../news/actions.ts`: a server action is a POST to an endpoint the browser
 * knows the id of, and the layout above it never runs for a POST. A function
 * here that trusted the layout would be an unauthenticated way to push a
 * stranger's application into Shunkhlai's ERP.
 *
 * The role check is the second statement, and it is not the button's job:
 * `editor` accounts are not offered the control and are refused here as well.
 *
 * The form sends the application's **key**, never an email. The key is the
 * idempotency hash already on the row (`erp-retry.ts`), and the account behind
 * it is looked up on the server — so nothing the browser holds identifies the
 * applicant, and a replayed POST can only name a row that exists.
 *
 * Nothing in this file hands an upstream message to the browser: the rows
 * carry classified codes, and the Mongolian wording is chosen from those codes
 * in `labels.ts`.
 */

export type DeskState = { message?: string; tone?: "ok" | "error" };

export async function retryApplicationAction(
  _previous: DeskState,
  formData: FormData,
): Promise<DeskState> {
  const user = await requireAdminUser();
  if (!mayRetryApplications(user)) {
    return { tone: "error", message: "Дахин илгээх эрх байхгүй байна. Админд хандана уу." };
  }

  const key = String(formData.get("key") ?? "").trim();
  if (!key) return { tone: "error", message: "Хүсэлт олдсонгүй." };

  try {
    const target = await resolveApplication(key);
    if (!target) return { tone: "error", message: "Хүсэлт олдсонгүй." };

    const result = await retryApplication(target.email, target.entryid);
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${key}`);
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
    // the desk; the admin sees that, not a 500. `String(error)` rather than the
    // error itself, so an upstream body cannot ride into the log.
    console.error("[admin/applications]", "retry_failed", String(error));
    return { tone: "error", message: "Дахин илгээж чадсангүй. Дараа дахин оролдоно уу." };
  }
}
