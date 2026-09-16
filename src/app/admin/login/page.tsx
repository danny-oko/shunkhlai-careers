import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { isAdminRequest } from "@/server/admin/guard";
import { adminLoginAvailable } from "@/server/admin/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  // Already signed in: the form would be a dead end, so skip it.
  if (await isAdminRequest()) redirect("/admin/news");

  const params = await searchParams;
  const requested = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = requested && requested.startsWith("/admin/") ? requested : "/admin/news";

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
          {adminLoginAvailable() ? (
            <LoginForm next={next} />
          ) : (
            /* A deployment with no password has no way in, and the operator
               has to be able to see that rather than guess at a rejection. */
            <div className="border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium">Админ нэвтрэлт тохируулаагүй байна.</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Серверийн тохиргоонд <code className="font-mono text-xs">ADMIN_PASSWORD</code>{" "}
                нэмнэ үү. Дэлгэрэнгүйг{" "}
                <code className="font-mono text-xs">docs/newsroom.md</code>-ээс уншина уу.
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
