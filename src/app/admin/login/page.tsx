import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { isAdminRequest } from "@/server/admin/guard";
import { signInAvailable } from "@/server/admin/sign-in";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  // Already signed in: the form would be a dead end, so skip it.
  if (await isAdminRequest()) redirect("/admin/news");

  const params = await searchParams;
  const requested = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = requested && requested.startsWith("/admin/") ? requested : "/admin/news";

  // There is a way in if a staff account exists, or — on a deployment where
  // nobody has created one yet — if ADMIN_PASSWORD is set. A database that
  // cannot be reached is not a reason to hide the form: let the attempt fail
  // with its own message rather than accusing the operator of misconfiguring
  // something they did not.
  const available = await signInAvailable().catch(() => true);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div
          aria-hidden
          className="h-[3px] w-14"
          style={{ backgroundImage: "var(--brand-gradient)" }}
        />

        <h1 className="news-headline mt-6 text-3xl">Мэдээний админ</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          Шунхлай Мэдээ хуудсанд мэдээ нийтлэх, засах, хасах.
        </p>

        <div className="mt-8 border-t border-border pt-8">
          {available ? (
            <LoginForm next={next} />
          ) : (
            /* No staff account and no ADMIN_PASSWORD: there is no way in at
               all, and the operator has to be able to see that rather than
               guess at a rejection. */
            <div className="border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium">Админ нэвтрэлт тохируулаагүй байна.</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                <code className="font-mono text-xs">bun run user:create</code>-ээр ажилтны
                бүртгэл үүсгэнэ үү. Дэлгэрэнгүйг{" "}
                <code className="font-mono text-xs">docs/postgres.md</code>-ээс уншина уу.
              </p>
            </div>
          )}
        </div>

        <Link
          href="/news"
          className="mt-8 inline-block text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          ← Мэдээний хуудас
        </Link>
      </div>
    </main>
  );
}
