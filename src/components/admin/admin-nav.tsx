"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Globe,
  Inbox,
  LayoutTemplate,
  LogOut,
  Menu,
  Newspaper,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { logoutAction } from "@/app/admin/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Everything in the admin shell that has to know where the reader is.
 *
 * Split out of `admin-shell.tsx` because that half is a server component — it
 * reads the signed-in identity through the guard — and this half needs
 * `usePathname()` for the active item and `useState` for the phone drawer. The
 * name comes down as a prop rather than being read again here, so there is
 * still exactly one place that asks who is signed in.
 *
 * The same list is drawn twice, by `<Destinations>`: once in the column at
 * `lg` and up, once inside the drawer below it. One source, so the phone and
 * the desktop can never offer different places to go.
 */

type Destination = { href: string; label: string; icon: LucideIcon };

/**
 * The three working desks. The labels are the pages' own `<h1>`s, not shorter
 * paraphrases of them: a nav item that says something different from the
 * heading it lands on is a second name for the same screen to learn.
 */
const DESKS: readonly Destination[] = [
  { href: "/admin/news", label: "Мэдээний удирдлага", icon: Newspaper },
  { href: "/admin/content", label: "Хуудасны контент", icon: LayoutTemplate },
  { href: "/admin/applications", label: "Ирсэн өргөдөл", icon: Inbox },
];

/**
 * Is this item the screen being read?
 *
 * Prefix-matched, not equality: `/admin/news/new` and `/admin/news/<id>` are
 * the newsroom, and an editor three screens deep still has to be able to see
 * which desk they are on. The trailing slash keeps a future `/admin/newsroom`
 * from lighting up `/admin/news`.
 */
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * One row of the sidebar.
 *
 * The active state is stated three times over — an accent bar on the leading
 * edge, a panel lifted out of the recessed sidebar ground, and a heavier
 * weight — because the one thing this shell replaces was a row of identical
 * ghost buttons where the current screen was indistinguishable from the other
 * two. `aria-current` carries the same fact to anyone not looking at it.
 *
 * `--paper-accent` rather than `--brand`: it is the newsroom's own orange,
 * darkened until it clears 4.5:1 at label sizes, which is the size this is.
 */
function NavItem({
  href,
  label,
  icon: Icon,
  current,
  sub,
  external,
  onNavigate,
}: Destination & {
  current?: boolean;
  /** A second line under the label — the signed-in name, on the account row. */
  sub?: string;
  external?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 py-2.5 pr-3 pl-4 text-[0.8125rem] transition-colors",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        current
          ? "bg-background font-semibold text-foreground before:bg-[var(--paper-accent)]"
          : "text-muted-foreground before:bg-transparent hover:bg-background/70 hover:text-foreground",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {label}
        {sub && (
          <span className="block truncate text-[0.75rem] font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      {external && (
        <ExternalLink aria-hidden className="size-3.5 shrink-0 opacity-70" />
      )}
    </Link>
  );
}

/**
 * The masthead, the primary action and the destinations — the body of the
 * sidebar, shared by the column and the drawer.
 *
 * The order is the argument. "Шинэ мэдээ" sits between the masthead and the
 * list, on its own between two rules, because it is the thing an editor comes
 * here to *do*; inside the list it would read as a fourth place to go, which
 * is what it looked like in the old bar. Below the list, past a rule, are the
 * two rows that are not desks at all: who you are, and the way out to the
 * public site.
 */
function Destinations({ userName, onNavigate }: { userName?: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="px-4 pt-4 pb-3.5">
        <Link
          href="/admin/news"
          onClick={onNavigate}
          className="flex min-w-0 flex-col focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="news-headline truncate text-[0.9375rem]">Шунхлай Мэдээ</span>
          <span className="text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase">
            Админ
          </span>
        </Link>
      </div>

      <div className="border-y border-border px-4 py-3.5">
        <Button asChild size="lg" className="w-full">
          <Link href="/admin/news/new" onClick={onNavigate}>
            <Plus aria-hidden />
            Шинэ мэдээ
          </Link>
        </Button>
      </div>

      <nav aria-label="Админ цэс" className="flex flex-col py-3">
        {DESKS.map((desk) => (
          <NavItem
            key={desk.href}
            {...desk}
            current={isCurrent(pathname, desk.href)}
            onNavigate={onNavigate}
          />
        ))}

        <div className="my-3 border-t border-border" />

        <NavItem
          href="/admin/account"
          label="Миний бүртгэл"
          icon={UserRound}
          sub={userName}
          current={isCurrent(pathname, "/admin/account")}
          onNavigate={onNavigate}
        />
        {/* `Globe` rather than the newsroom's own `Newspaper`: this goes to
            the same stories, but on the public site, and two rows with the
            same glyph would read as two ways to the same screen. */}
        <NavItem
          href="/news"
          label="Нийтлэлүүдийг харах"
          icon={Globe}
          external
          onNavigate={onNavigate}
        />
      </nav>
    </>
  );
}

/**
 * The bottom rail: the two controls that are not navigation.
 *
 * Pinned to the foot and behind a heavier rule than the ones above it, so
 * neither can be mistaken for a third desk — "Гарах" in particular was one
 * ghost button among six in the old bar, a keystroke away from the link
 * beside it.
 */
function Rail() {
  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-t-[var(--rule-strong)] px-4 py-3">
      <ThemeToggle />
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
          <LogOut aria-hidden />
          Гарах
        </Button>
      </form>
    </div>
  );
}

/**
 * The shell's chrome: a fixed column from `lg`, a bar and a drawer below it.
 *
 * At 390px a 240px column would leave 150px of page, so the column is not
 * narrowed — it is taken away and put behind the menu button, which is the
 * only arrangement in which the working area still has a usable measure.
 *
 * The drawer carries `data-newsroom` of its own: Radix portals its content to
 * `<body>`, outside the element in `admin/layout.tsx` that declares
 * `--paper-accent` and `--rule-strong`, and without it the active marker and
 * the rail's rule would resolve to nothing inside the drawer only.
 */
export function AdminNav({ userName }: { userName?: string }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-muted/40 lg:flex">
        <div
          aria-hidden
          className="h-[3px] shrink-0"
          style={{ backgroundImage: "var(--brand-gradient)" }}
        />
        <Destinations userName={userName} />
        <Rail />
      </aside>

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md lg:hidden">
        <div
          aria-hidden
          className="h-[3px]"
          style={{ backgroundImage: "var(--brand-gradient)" }}
        />

        <div className="flex h-14 items-center gap-2 px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Админ цэс">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="left"
              showCloseButton={false}
              data-newsroom
              className="w-[17rem] gap-0 border-border bg-background p-0 text-foreground"
            >
              <div
                aria-hidden
                className="h-[3px] shrink-0"
                style={{ backgroundImage: "var(--brand-gradient)" }}
              />
              {/* Radix needs a title on every dialog; the masthead below is a
                  link and cannot be one, so the accessible name is given here
                  and hidden rather than printed twice. */}
              <SheetTitle className="sr-only">Админ цэс</SheetTitle>

              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Хаах"
                  className="absolute top-4 right-3"
                >
                  <X aria-hidden />
                </Button>
              </SheetClose>

              <Destinations userName={userName} onNavigate={close} />
              <Rail />
            </SheetContent>
          </Sheet>

          <Link
            href="/admin/news"
            className="min-w-0 flex-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="news-headline block truncate text-[0.9375rem]">Шунхлай Мэдээ</span>
          </Link>

          {/* Still the primary action, still filled, but the words drop on a
              phone: the newsroom desk under this bar carries its own
              full-size "Шинэ мэдээ", and two identical orange buttons a
              thumb's width apart read as a mistake rather than as emphasis.
              The label comes back as soon as there is room for it. */}
          <Button asChild size="lg" aria-label="Шинэ мэдээ">
            <Link href="/admin/news/new">
              <Plus aria-hidden />
              <span className="hidden sm:inline">Шинэ мэдээ</span>
            </Link>
          </Button>
        </div>
      </header>
    </>
  );
}
