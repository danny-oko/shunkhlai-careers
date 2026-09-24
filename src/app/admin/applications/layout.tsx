import { AdminShell } from "@/components/admin/admin-shell";

/**
 * The gate, same as `admin/news/layout.tsx` and `admin/content/layout.tsx` —
 * `AdminShell` runs `requireAdminUser()` before it draws anything, so no
 * screen under `/admin/applications` can render without passing through it.
 *
 * Both roles read this desk. The one control that writes (`actions.ts`) checks
 * for `admin` itself, because a POST does not come through a layout.
 */
export default function AdminApplicationsLayout({
  children,
}: LayoutProps<"/admin/applications">) {
  return <AdminShell>{children}</AdminShell>;
}
