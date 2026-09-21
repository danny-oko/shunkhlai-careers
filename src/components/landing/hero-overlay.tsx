import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { HeroSlide } from "@/components/landing/hero-slides";
import { heroSlides } from "@/components/landing/hero-slides";
import { cn } from "@/lib/utils";

/**
 * The type that sits in front of the hero footage.
 *
 * It lives in the lower half of the frame on purpose: the campaign posters
 * carry their own lockup across the top, so nothing here ever lands on it.
 * The page's headline is not here — it has a screen of its own, in
 * <StatementScreen>, straight after this one.
 */
export function HeroOverlay({
  slide,
  active,
  roleCount,
  onSelect,
}: {
  slide: HeroSlide;
  active: number;
  roleCount: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-10 sm:pb-14 lg:px-10 lg:pb-16">
        <p
          key={slide.word}
          className="brand-word-in text-[clamp(1.1875rem,0.9583rem_+_1.0185vw,1.875rem)] font-semibold tracking-[-0.02em] [text-shadow:0_2px_24px_rgb(0_0_0/45%)]"
        >
          Хөдөлмөр {slide.word} хөдөлгүүр
          <span className="mt-1 block type-copy font-medium opacity-75">
            {slide.caption} · {slide.captionEn}
          </span>
        </p>

        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="h-11 rounded-full px-6 type-copy">
              <Link href="/careers">
                {roleCount} нээлттэй ажлын байр
                <ArrowRight className="ml-1 size-4 transition-transform group-hover/button:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full border-white/35 bg-white/10 px-6 type-copy text-white backdrop-blur-sm hover:bg-white/20 hover:text-white dark:border-white/35 dark:bg-white/10 dark:hover:bg-white/20"
            >
              <Link href="/about">Бидний тухай</Link>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {heroSlides.map((item, index) => (
              <button
                key={item.src}
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`${item.caption} зураг харах`}
                aria-current={index === active}
                className={cn(
                  "h-1 rounded-full transition-all duration-500",
                  index === active
                    ? "w-10 bg-brand-2"
                    : "w-5 bg-white/40 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
