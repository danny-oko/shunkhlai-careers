import { AdminBar } from "@/components/admin/admin-bar";
import { requireAdmin } from "@/server/admin/guard";

/**
 * The gate.
 *
 * `src/proxy.ts` has already redirected an unauthenticated navigation, but
 * this is the check that matters: a layout runs on the server for every page
 * beneath it, so no screen under `/admin/news` can render without passing
 * through here. The actions repeat it for themselves, because a POST does not
 * come through a layout.
 */
export default async function AdminNewsLayout({
  children,
}: LayoutProps<"/admin/news">) {
  await requireAdmin();

  return (
    <>
      <AdminBar />
      {children}
    </>
  );
}
