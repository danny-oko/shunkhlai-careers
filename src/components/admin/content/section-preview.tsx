"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";

import type {
  AboutStatsContent,
  CultureContent,
  CultureWall,
  FooterContent,
  HeroContent,
  HistoryContent,
} from "@/lib/content/schema";
import { cn } from "@/lib/utils";

/**
 * What each section will look like, drawn from what is currently in the form.
 *
 * The desk used to be twenty short strings with nothing to attach them to:
 * "Тайлбар" is a word under an input until you have seen it sitting under the
 * headline on the dark hero, and "Утга" is a word until you have seen it in
 * the footer column next to its label. These are small — a band the height of
 * a couple of rows at the top of each panel — and they redraw as the admin
 * types, so the answer to "what am I editing" is on the same screen as the
 * edit.
 *
 * They are **not** the real components. Rendering `<HeroStage>` here would
 * drag in the carousel timer, the recruitment API's live role count and the
 * public page's fluid type scale, for a picture two inches tall. What these
 * reproduce is the thing an editor is actually checking: the order, the
 * grouping, and which words land on which ground.
 *
 * Every one of them is `aria-hidden`. Each value shown is also present, a few
 * centimetres below, in a labelled input that a screen reader can read and
 * edit — so this band would only be the same content a second time, without
 * the labels.
 *
 * `--ink` is the site's own dark ground, the one all three of these sections
 * are printed on, and `--brand` is its accent. Reusing the tokens rather than
 * picking colours here is what keeps the preview honest when the theme moves.
 */

/** The frame every preview sits in. */
function Stage({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn(
        "overflow-hidden border-b border-border bg-ink px-4 py-4 text-ink-foreground lg:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A look at whatever address is in a row, so a wrong paste is obvious. */
export function Thumb({ src, className }: { src: string; className?: string }) {
  const valid = src.startsWith("/") || src.startsWith("https://");

  return (
    <div className={cn("relative shrink-0 overflow-hidden border border-border bg-muted", className)}>
      {valid ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="96px"
          // The address can be any https host an admin pasted, and this is a
          // thumbnail on a desk — not worth teaching the optimiser about.
          unoptimized
          className="object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageOff aria-hidden className="size-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/**
 * The hero, as the first slide plus the run behind it.
 *
 * The filmstrip is the point: the slides cycle, and their order is a thing an
 * admin can now change, so the preview has to show the queue and not only
 * whichever one is in front.
 */
export function HeroPreview({ value }: { value: HeroContent }) {
  const [first, ...rest] = value.slides;

  return (
    <Stage className="flex flex-wrap items-stretch gap-4 p-0 lg:p-0">
      <div className="relative min-h-[8.5rem] min-w-56 flex-1 basis-64">
        {first && <Thumb src={first.src} className="absolute inset-0 border-0" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="relative flex h-full flex-col justify-end gap-2.5 p-4 text-white">
          <p className="text-[0.9375rem] leading-tight font-semibold tracking-[-0.02em] text-balance">
            {value.heading || "—"}
            <span className="mt-0.5 block text-[0.75rem] font-medium opacity-75">
              {first?.caption}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand px-3 py-1 text-[0.6875rem] font-medium text-brand-foreground">
              {value.primaryCta.label || "—"}
            </span>
            <span className="rounded-full border border-white/35 bg-white/10 px-3 py-1 text-[0.6875rem] font-medium">
              {value.secondaryCta.label || "—"}
            </span>
          </div>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 py-4 pr-4">
          {rest.map((slide, index) => (
            <div key={index} className="flex w-16 flex-col gap-1">
              <Thumb src={slide.src} className="h-11 w-16" />
              <span className="truncate text-[0.625rem] text-ink-muted">{slide.caption}</span>
            </div>
          ))}
        </div>
      )}
    </Stage>
  );
}

/** The foot of every page: the address line, then the contact column. */
export function FooterPreview({ value }: { value: FooterContent }) {
  return (
    <Stage className="flex flex-wrap gap-x-10 gap-y-4">
      <p
        className={cn(
          "max-w-xs text-[0.8125rem] leading-relaxed",
          value.addressUrl && "underline decoration-white/30 underline-offset-4",
        )}
      >
        {value.address || "—"}
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.8125rem]">
        {value.contacts.map((contact, index) => (
          <div key={index} className="contents">
            <dt className="text-ink-muted">{contact.label || "—"}</dt>
            <dd className={cn(contact.href && "underline decoration-white/30 underline-offset-4")}>
              {contact.value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </Stage>
  );
}

/** The figures that close `/about`, in the order they are printed. */
export function AboutStatsPreview({ value }: { value: AboutStatsContent }) {
  return (
    <Stage>
      <p className="text-[0.8125rem] font-semibold">{value.heading || "—"}</p>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        {value.items.map((item, index) => (
          <div key={index} className="min-w-24">
            <p className="text-brand text-xl leading-none font-semibold tabular-nums">
              {item.value || "—"}
            </p>
            <p className="mt-1 text-[0.6875rem] leading-snug text-ink-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/** How many tiles the strip shows before it says "and N more". */
const WALL_STRIP = 14;

/**
 * The culture wall: the heading, the rail, and the wall that is open.
 *
 * The real thing is a sphere that turns with the scroll, which no two-inch
 * band can be. What is worth checking at a glance is which picture each tile
 * opens on and whether it is a photograph or a club's plated lockup — so the
 * strip is the tiles in order, drawn the way the wall draws each kind.
 */
export function CulturePreview({
  value,
  active,
  walls,
}: {
  value: CultureContent;
  active: CultureWall;
  walls: readonly CultureWall[];
}) {
  const items = value.walls[active].items;
  const shown = items.slice(0, WALL_STRIP);

  return (
    <Stage>
      <p className="text-[0.9375rem] leading-tight font-semibold tracking-[-0.02em]">
        {value.heading || "—"}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {walls.map((wall) => (
          <span
            key={wall}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[0.6875rem]",
              wall === active ? "bg-brand text-brand-foreground" : "border border-white/20 text-ink-muted",
            )}
          >
            {value.walls[wall].label || "—"}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-end gap-1.5 overflow-hidden">
        {shown.map((item, index) =>
          // The wall shows a club's lockup even where the club sent photographs:
          // those open in the dialog behind it.
          item.logo ? (
            <div key={index} className="flex h-10 w-16 shrink-0 items-center bg-white p-1">
              <Thumb src={item.logo} className="h-full w-full border-0 bg-white [&_img]:object-contain" />
            </div>
          ) : (
            <Thumb key={index} src={item.images[0] ?? ""} className="h-14 w-11" />
          ),
        )}
        {items.length > shown.length && (
          <span className="shrink-0 pb-1 text-[0.6875rem] text-ink-muted">
            +{items.length - shown.length}
          </span>
        )}
      </div>
    </Stage>
  );
}

/**
 * Түүхэн замнал: the rail of years, each over the photograph its record
 * opens on, in the order the scroll reads them.
 */
export function HistoryPreview({ value }: { value: HistoryContent }) {
  return (
    <Stage>
      <p className="text-[0.8125rem] font-semibold">Түүхэн замнал</p>
      <div className="mt-3 flex items-start gap-2 overflow-hidden">
        {value.entries.map((entry, index) => (
          <div key={index} className="flex w-14 shrink-0 flex-col gap-1">
            <Thumb src={entry.image} className="h-[4.5rem] w-14" />
            <p className="text-brand text-[0.75rem] leading-none font-semibold tabular-nums">
              {entry.year || "—"}
            </p>
            <p className="line-clamp-2 text-[0.625rem] leading-snug text-ink-muted">
              {entry.title}
            </p>
          </div>
        ))}
      </div>
    </Stage>
  );
}
