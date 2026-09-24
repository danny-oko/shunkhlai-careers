import { AdminShell } from "@/components/admin/admin-shell";

/**
 * The gate, and the chrome that cannot be mounted without it.
 *
 * `src/proxy.ts` has already redirected an unauthenticated navigation, but
 * this is the check that matters: a layout runs on the server for every page
 * beneath it, so no screen under `/admin/news` can render without passing
 * through here. `AdminShell` is where `requireAdminUser()` now lives — it
 * needs the signed-in name for the sidebar anyway, and keeping the two
 * together means a new admin desk gets the check by wrapping the shell rather
 * than by remembering a second line. The actions repeat it for themselves,
 * because a POST does not come through a layout.
 */
export default function AdminNewsLayout({ children }: LayoutProps<"/admin/news">) {
  return <AdminShell>{children}</AdminShell>;
}
