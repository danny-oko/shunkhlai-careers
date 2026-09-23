import Link from "next/link";

import { AdminBar } from "@/components/admin/admin-bar";
import { PasswordForm } from "@/components/admin/password-form";
import { requireAdminUser } from "@/server/admin/guard";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's own page: who they are, and the one thing they can
 * change about themselves.
 *
 * Its own `requireAdminUser()` rather than a shared layout, because this page
 * is the only one outside `/admin/news` that needs the gate — and because it
 * needs the identity, not only the permission.
 *
 * Creating and deactivating accounts is deliberately not here: that is
 * `bun run user:create` and SQL for now, and a screen that can mint admins is
 * a bigger thing than this slice.
 */
export default async function AdminAccountPage() {
  const user = await requireAdminUser();
  const fallback = user.source === "admin-password";

  return (
    <>
      <AdminBar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 lg:px-8">
        <h1 className="news-headline text-2xl">Миний бүртгэл</h1>

        <dl className="mt-6 grid max-w-sm grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Нэр</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">И-мэйл</dt>
          <dd>{user.email || "—"}</dd>
          <dt className="text-muted-foreground">Эрх</dt>
          <dd>{user.role}</dd>
        </dl>

        <div className="mt-10 border-t border-border pt-8">
          {fallback ? (
            /* Signed in through the ADMIN_PASSWORD fallback: there is no row
               to change a password on, and saying so is more use than a form
               that would refuse. */
            <div className="max-w-sm border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium">
                ADMIN_PASSWORD-оор нэвтэрсэн байна.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Ажилтны бүртгэл үүсгэсний дараа нууц үгээ эндээс солино.{" "}
                <code className="font-mono text-xs">bun run user:create</code>
              </p>
            </div>
          ) : (
            <PasswordForm />
          )}
        </div>

        <Link
          href="/admin/news"
          className="mt-10 inline-block text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          ← Мэдээний жагсаалт
        </Link>
      </main>
    </>
  );
}
