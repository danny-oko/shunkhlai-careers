import { redirect } from "next/navigation";

/** There is one desk, so `/admin` is just its address. */
export default function AdminIndexPage() {
  redirect("/admin/news");
}
