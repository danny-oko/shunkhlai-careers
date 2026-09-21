import Link from "next/link";
import { ExternalLink, LogOut, Plus } from "lucide-react";

import { logoutAction } from "@/app/admin/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function AdminBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div
        aria-hidden
        className="h-[3px]"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      />

      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5 lg:px-8">
        <Link
          href="/admin/news"
          className="flex min-w-0 items-baseline gap-2.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="news-headline truncate text-[0.9375rem]">
            Шунхлай Мэдээ
          </span>
          <span className="shrink-0 text-[0.5625rem] tracking-[0.16em] text-muted-foreground uppercase">
            Админ
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />

          <Button
            asChild
            variant="ghost"
            size="sm"
          >
            <Link
              href="/news"
              target="_blank"
              rel="noreferrer"
              aria-label="Нийтлэлүүдийг харах"
            >
              <ExternalLink aria-hidden />
              <span className="hidden sm:inline">Нийтлэлүүдийг харах</span>
            </Link>
          </Button>

          <Button asChild size="sm">
            <Link href="/admin/news/new">
              <Plus aria-hidden />
              Шинэ мэдээ
            </Link>
          </Button>

          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              aria-label="Гарах"
            >
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Гарах</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
