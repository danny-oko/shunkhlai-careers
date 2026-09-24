import { AdminBar } from "@/components/admin/admin-bar";
import { requireAdmin } from "@/server/admin/guard";

/**
 * The gate, same as `admin/news/layout.tsx`.
 *
 * A layout runs on the server for every page beneath it, so no screen under
 * `/admin/content` can render without passing through here. `src/proxy.ts`
 * has already redirected an unauthenticated navigation and the save action
 * repeats the check for itself — a POST does not come through a layout.
 */
export default async function AdminContentLayout({
  children,
}: LayoutProps<"/admin/content">) {
  await requireAdmin();

  return (
    <>
      <AdminBar />
      {children}
    </>
  );
}
