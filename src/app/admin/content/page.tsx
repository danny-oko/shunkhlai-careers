import { redirect } from "next/navigation";

import { CONTENT_KEYS } from "@/lib/content/schema";

/**
 * The content desk has no page of its own: each section is edited on its own
 * screen under `/admin/content/<section>`, and the sidebar's "Хуудасны
 * контент" lands on the first of them.
 */
export default function AdminContentPage() {
  redirect(`/admin/content/${CONTENT_KEYS[0]}`);
}
