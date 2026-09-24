import { AdminShell } from "@/components/admin/admin-shell";

/**
 * New with the sidebar. The account page used to draw the admin bar itself
 * and call the guard in its own body, which was fine while the chrome was one
 * component — but a shell that has to wrap the page's children cannot be
 * mounted from inside the page. So the gate and the frame move up here, the
 * same three lines as the two desks beside it, and the page keeps its own
 * `requireAdminUser()` because it needs the identity it returns.
 */
export default function AdminAccountLayout({ children }: LayoutProps<"/admin/account">) {
  return <AdminShell>{children}</AdminShell>;
}
