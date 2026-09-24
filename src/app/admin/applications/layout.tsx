import { AdminBar } from "@/components/admin/admin-bar";
import { requireAdmin } from "@/server/admin/guard";

/**
 * The gate, for the same reason as `../news/layout.tsx`: the proxy has already
 * redirected an unauthenticated navigation, but a layout is the check that
 * actually runs on the server for every screen beneath it. The actions repeat
 * it, because a POST never comes through here.
 */
export default async function AdminApplicationsLayout({
  children,
}: LayoutProps<"/admin/applications">) {
  await requireAdmin();

  return (
    <>
      <AdminBar />
      {children}
    </>
  );
}
