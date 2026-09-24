import Link from "next/link";

import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/news/types";
import { cn } from "@/lib/utils";

/**
 * The section line.
 *
 * A newspaper's sections are set as small caps across the top of the page, not
 * as buttons, so these are text links with a rule under the active one rather
 * than filled pills. Deliberately small — this is navigation between views of
 * the same thing, and at pill size it would out-shout the first headline.
 *
 * Plain links, so the filter is in the URL: a reader can bookmark a desk, and
 * the page stays renderable without JavaScript.
 */
/**
 * Desks kept off the line.
 *
 * Nothing is removed from the newsroom's own model by this: a story already
 * filed under one of these is still published, still counted in Бүгд and
 * still carries its own kicker - it simply has no section of its own across
 * the top, and the editor can still file to it. Taking the desk out of
 * `NEWS_CATEGORIES` instead would make every stored story under it fail to
 * read back.
 */
const OFF_THE_LINE: ReadonlyArray<NewsCategory> = ["society"];

export function CategoryRail({
  active,
  counts,
  total,
}: {
  active: NewsCategory | null;
  counts: Record<NewsCategory, number>;
  total: number;
}) {
  const items = [
    { href: "/news", label: "Бүгд", count: total, isActive: active === null },
    ...NEWS_CATEGORIES.filter(
      (category) => !OFF_THE_LINE.includes(category.value),
    ).map((category) => ({
      href: `/news?category=${category.value}`,
      label: category.label,
      count: counts[category.value],
      isActive: active === category.value,
    })),
  ];

  return (
    <nav
      aria-label="Мэдээний бүлэг"
      className="relative border-b border-border bg-background"
    >
      {/* The sections fit on one line above `lg` and do not below it, so the
          rail scrolls sideways rather than wrapping to two rows — two rows of
          sections reads as a menu rather than as a rail. The fade is the only
          thing that says it scrolls, since the scrollbar is hidden; it is
          dropped at `lg`, where there is nothing left to scroll to. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 lg:hidden"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent, var(--background) 70%)",
        }}
      />
      <div className="no-scrollbar mx-auto flex max-w-6xl gap-5 overflow-x-auto px-6 lg:gap-7 lg:px-10">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.isActive ? "page" : undefined}
            className={cn(
              "relative shrink-0 py-3 type-kicker tracking-[0.14em] whitespace-nowrap uppercase transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              item.isActive
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            <span className="ml-1.5 type-kicker tabular-nums opacity-55">
              {item.count}
            </span>
            {item.isActive && (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-0.5"
                style={{ backgroundImage: "var(--brand-gradient)" }}
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
