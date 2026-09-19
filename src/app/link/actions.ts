"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { linkAccount, saveProfile } from "@/server/erp/link";
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
    regno: formData.get("regno"),
    phone: formData.get("phone"),
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
    return { ok: false, error: e instanceof Error ? e.message : "Алдаа гарлаа." };
  }
}

const profileSchema = z.object({
  lastname: z.string().trim().optional(),
  firstname: z.string().trim().optional(),
  email2: z.string().trim().optional(),
  addr2: z.string().trim().optional(),
  maritalstatus: z.string().trim().optional(),
});

export type ProfileState = { ok: boolean; error?: string; savedAt?: number };

/**
 * Writes edited personal data back to the ERP and re-syncs our D1 mirror, for
 * the signed-in Clerk user.
 */
export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Эхлээд нэвтэрнэ үү." };

  const parsed = profileSchema.safeParse({
    lastname: formData.get("lastname") ?? undefined,
    firstname: formData.get("firstname") ?? undefined,
    email2: formData.get("email2") ?? undefined,
    addr2: formData.get("addr2") ?? undefined,
    maritalstatus: formData.get("maritalstatus") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Мэдээлэл буруу байна." };
  }

  try {
    await saveProfile(userId, {
      lastname: parsed.data.lastname,
      firstname: parsed.data.firstname,
      email2: parsed.data.email2,
      addr2: parsed.data.addr2,
      // empty select → clear it (null); otherwise the chosen key
      maritalstatus: parsed.data.maritalstatus ? parsed.data.maritalstatus : null,
    });
    return { ok: true, savedAt: Date.now() };
  } catch (e) {
    if (e instanceof ErpError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Алдаа гарлаа." };
  }
}
