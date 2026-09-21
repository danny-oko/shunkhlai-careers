import { formatNewsDate } from "@/lib/news/types";

/**
 * The front page's nameplate.
 *
 * Built from the three things a broadsheet masthead always has, in order: a
 * folio line of small caps metadata, the nameplate itself at a size nothing
 * else on the page competes with, and a heavy rule closing it off. The point
 * of the arrangement is that a reader knows what they are looking at before
 * they have read a single word of it.
 *
 * The brand gradient runs as a 3px band along the very top — the one place the
 * newsroom says "Shunkhlai" in the brand's own voice rather than the paper's.
 */
export function Masthead({
  storyCount,
  today,
}: {
  storyCount: number;
  /** Passed in rather than read here, so the page decides what "today" means. */
  today: string;
}) {
  return (
    <header className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      />
      <div aria-hidden className="news-paper-grid absolute inset-0" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        {/* Folio line. `justify-between` with the middle item hidden on a
            phone keeps the date on the right edge where it is read. */}
        <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 type-kicker tracking-[0.16em] text-muted-foreground uppercase">
          <span className="font-medium">Шунхлай ХХК</span>
          <span className="hidden sm:inline">Улаанбаатар</span>
          <span className="tabular-nums">{formatNewsDate(today)}</span>
        </div>

        <div className="py-9 text-center sm:py-14">
          <h1 className="news-headline text-[clamp(2.125rem,8.5vw,5.25rem)] uppercase">
            Шунхлай Мэдээ
          </h1>
          <p className="mx-auto mt-4 max-w-md type-kicker tracking-[0.2em] text-muted-foreground uppercase">
            Компанийн сурвалжилга · Салбарын мэдээ · Хүний нөөц
          </p>
        </div>

        <div className="news-rule-double" />

        <p className="py-2.5 text-center type-kicker tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
          {storyCount > 0 ? `Архивт ${storyCount} мэдээ` : "Архив хоосон"}
        </p>
      </div>
    </header>
  );
}
