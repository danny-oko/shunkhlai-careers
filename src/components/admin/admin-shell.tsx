import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminUser } from "@/server/admin/guard";

/**
 * The frame every signed-in admin screen is drawn in: the gate, the sidebar,
 * and the column the page itself gets.
 *
 * It replaces `admin-bar.tsx`, which put the brand, a theme toggle, four
 * links, a primary button and a logout on one 56px strip. Nothing in that row
 * said which screen was open, the destinations and the controls were the same
 * ghost buttons, and below `sm` every label was dropped — so the desk became
 * six unlabelled icons. A column has room to say all of it in words.
 *
 * **The gate is inside the shell on purpose.** `requireAdminUser()` is called
 * here rather than in the layouts that mount this, so there is no way to put
 * an admin screen inside the chrome without also putting it behind the check.
 * It also needs the identity, not only the permission: the account row in the
 * sidebar carries the signed-in name, which is the difference between
 * "someone is logged in here" and "I am".
 *
 * `/admin/login` does not mount this — it has to render for someone who is not
 * signed in yet, and `admin/layout.tsx` above stays a bare ground for exactly
 * that reason. Server actions repeat the check for themselves; a POST does not
 * come through a layout.
 */
export async function AdminShell({ children }: { children: ReactNode }) {
  const user = await requireAdminUser();

  return (
    /* One grid rather than a fixed column and a padded page: the sidebar's
       width is declared once, and the main column is whatever is left, so
       nothing has to be kept in sync with a `pl-60` somewhere else. Below
       `lg` the grid collapses to a single track and the nav becomes the top
       bar and drawer that `AdminNav` draws instead.

       `--admin-bar-h` is how much chrome sits above the page: the phone's
       top bar (3px rule + 56px) below `lg`, and nothing at all above it,
       where the nav is a column beside the page rather than over it. The
       newsroom's two sticky toolbars offset themselves by it instead of
       hard-coding the old bar's 56px, which on a wide screen now left them
       floating a bar's height below the top of the window. */
    <div className="flex min-h-screen flex-1 flex-col [--admin-bar-h:59px] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:[--admin-bar-h:0px]">
      <AdminNav userName={user.name} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
