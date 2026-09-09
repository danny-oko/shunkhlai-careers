"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The opening loader measures this element to land its wordmark on it. */
export const SITE_BRAND_ID = "site-brand";

const links = [
  { href: "/", label: "Нүүр" },
  { href: "/about", label: "Бидний тухай" },
  { href: "/careers", label: "Нээлттэй ажлын байр" },
];

/**
 * Shared top bar.
 *
 * Fixed to the viewport on every page. It carries no border while the page is
 * at rest at the top and hardens into a bordered, blurred bar once scrolled,
 * so the hero reads as one uninterrupted block on first paint.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isLifted = isScrolled || isOpen;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 bg-background/85 text-foreground backdrop-blur-md transition-[border-color,box-shadow] duration-500",
        isLifted ? "border-b border-border/70" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
        <Link
          href="/"
          id={SITE_BRAND_ID}
          className="group flex items-center gap-2.5"
        >
          <span
            aria-hidden
            className="h-5 w-1.5 rounded-full"
            style={{ backgroundImage: "var(--brand-gradient)" }}
          />
          <span className="text-sm font-semibold tracking-[-0.01em]">
            Шунхлай <span className="opacity-60">Careers</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-sm transition-opacity",
                  isActive ? "opacity-100" : "opacity-65 hover:opacity-100",
                )}
              >
                {link.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3.5 -bottom-0.5 h-px"
                    style={{ backgroundImage: "var(--brand-gradient)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button
            asChild
            className="hidden h-9 rounded-full px-4 sm:inline-flex"
          >
            <Link href="/careers">Ажлын байр үзэх</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={isOpen ? "Цэс хаах" : "Цэс нээх"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            className="rounded-full md:hidden"
          >
            {isOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <nav className="border-t border-border/70 bg-background px-6 pb-5 text-foreground md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block border-b border-border/50 py-3.5 text-base last:border-0"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
