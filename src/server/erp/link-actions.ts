"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { linkAccount } from "@/server/erp/link";
import { ErpError } from "@/server/erp/client";

const schema = z.object({
  regno: z.string().trim().min(1, "Регистрийн дугаараа оруулна уу."),
  phone: z.string().trim().min(1, "Утасны дугаар / нууц үгээ оруулна уу."),
  firstname: z.string().trim().optional(),
  lastname: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

export type LinkState = { ok: boolean; error?: string };

/**
 * Verifies the applicant's ERP credentials and stores the encrypted link for
 * the signed-in Clerk user. Returns a flat state for `useActionState`.
 */
export async function linkAccountAction(
  _prev: LinkState,
  formData: FormData
): Promise<LinkState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Эхлээд нэвтэрнэ үү." };

  const parsed = schema.safeParse({
    // A missing field is null; "" lets zod report the Mongolian min(1) message.
    regno: formData.get("regno") ?? "",
    phone: formData.get("phone") ?? "",
    firstname: formData.get("firstname") ?? undefined,
    lastname: formData.get("lastname") ?? undefined,
    email: formData.get("email") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Мэдээлэл дутуу байна." };
  }

  try {
    await linkAccount({
      clerkUserId: userId,
      regno: parsed.data.regno,
      phone: parsed.data.phone,
      firstname: parsed.data.firstname || undefined,
      lastname: parsed.data.lastname || undefined,
      email: parsed.data.email || undefined,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ErpError) return { ok: false, error: e.message };
    console.error("[erp/link-actions] link failed", e);
    return { ok: false, error: "Алдаа гарлаа." };
  }
}
