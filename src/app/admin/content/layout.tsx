import { AdminShell } from "@/components/admin/admin-shell";

/**
 * The gate, same as `admin/news/layout.tsx` — `AdminShell` runs
 * `requireAdminUser()` before it draws anything, so no screen under
 * `/admin/content` can render without passing through it. `src/proxy.ts` has
 * already redirected an unauthenticated navigation and the save action repeats
 * the check for itself; a POST does not come through a layout.
 */
export default function AdminContentLayout({ children }: LayoutProps<"/admin/content">) {
  return <AdminShell>{children}</AdminShell>;
}
