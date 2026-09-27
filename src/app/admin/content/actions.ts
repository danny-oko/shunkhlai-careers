"use server";

import { revalidatePath } from "next/cache";

import { CONTENT_SECTIONS } from "@/lib/content/defaults";
import { formDocument } from "@/lib/content/form";
import {
  CONTENT_DB_ERROR,
  CONTENT_SCHEMAS,
  contentFieldErrors,
  isContentKey,
} from "@/lib/content/schema";
import { requireAdmin } from "@/server/admin/guard";
import { writeSection } from "@/server/content/store";

/**
 * The one write the content desk can do: save a section.
 *
 * `requireAdmin()` is the first statement, as it is in every newsroom action
 * and for the same reason — a server action is a POST to an endpoint whose id
 * the client knows, so it has to refuse on its own rather than trust the
 * proxy that turned unauthenticated *navigations* away. A function that
 * skipped it would be an unauthenticated way to rewrite the front page.
 *
 * The save is all-or-nothing per section: the posted fields become one
 * document, the section's zod schema either accepts that document or the save
 * is refused with a message per field. Nothing half-parsed is written, so a
 * row in `site_content` is always a shape the public read can use.
 *
 * It answers in place rather than redirecting, unlike the newsroom's save.
 * There is nowhere to go — the desk is one page with all three sections on
 * it — and a redirect would throw away the field errors that tell the admin
 * which of twenty inputs was wrong.
 */

export type ContentActionState = {
  ok?: boolean;
  /** Which section this outcome belongs to, so the other two stay quiet. */
  section?: string;
  /** Mongolian, like everything else the admin reads. */
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveSectionAction(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  await requireAdmin();

  const section = String(formData.get("section") ?? "");
  if (!isContentKey(section)) {
    // Only reachable by hand-posting; there is no control that can produce it.
    return { message: "Ийм хэсэг байхгүй." };
  }

  const parsed = CONTENT_SCHEMAS[section].safeParse(formDocument(section, formData));
  if (!parsed.success) {
    return {
      section,
      message: "Хадгалж чадсангүй. Доорх талбаруудыг шалгана уу.",
      fieldErrors: contentFieldErrors(parsed.error),
    };
  }

  try {
    // `updatedBy` stays null until /admin signs in as an `app_user` row
    // rather than with ADMIN_PASSWORD — see docs/postgres.md.
    await writeSection(section, parsed.data, null);
  } catch (error) {
    console.error(
      `[admin/content] save of "${section}" failed:`,
      error instanceof Error ? error.message : error,
    );
    return { section, message: CONTENT_DB_ERROR };
  }

  /**
   * The public pages read the database on render, so this is not clearing a
   * server-side copy of the content so much as the two caches that could
   * still be showing the previous one: the browser's client router cache, and
   * the home page's five-minute ISR window (it is `revalidate = 300` for the
   * recruitment API, not `force-dynamic`). The footer is in the root layout,
   * so it revalidates as a layout — every page at once.
   */
  for (const { path, type } of CONTENT_SECTIONS[section].paths) revalidatePath(path, type);
  revalidatePath("/admin/content", "layout");

  return { ok: true, section, message: "Хадгалагдлаа." };
}
