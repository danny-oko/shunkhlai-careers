"use client";

import * as React from "react";

import { FeatherLattice } from "@/components/brand/feather-lattice";
import { GradientRule } from "@/components/brand/gradient-rule";
import { SectionRail } from "@/components/aboutUs/section-rail";

/** One line per swing, as on the landing page's statement screen. */
const LINES = ["Авто засварын", "багаас улс даяарх", "сүлжээ хүртэл"];

/**
 * The five in the middle all now live in one section, as its tabs. The links
 * still carry their own hashes: CultureSection keeps an anchor for each, and
 * opens on whichever one was asked for.
 */
const anchors = [
  { key: "history", href: "#history", label: "Бидний түүх" },
  { key: "vision", href: "#vision", label: "Алсын хараа" },
  { key: "values", href: "#values", label: "Үнэт зүйл" },
  { key: "academy", href: "#academy", label: "Сургалт, хөгжил" },
  { key: "benefits", href: "#benefits", label: "Хөнгөлөлт, хангамж" },
  { key: "clubs", href: "#clubs", label: "Хобби клубууд" },
  { key: "life", href: "#life", label: "Ажилтны түүх" },
];

/**
 * Opening screen for the About page.
 *
 * Built like the landing page's statement: a whole screen of type on the ink
 * ground, each line swinging up off a skew as the screen is reached. The
 * anchors sit underneath so the page can still be entered anywhere.
 */
export function AboutHero() {
  const ref = React.useRef<HTMLElement>(null);
  const [isShown, setIsShown] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsShown(true);
        observer.disconnect();
      },
      { threshold: 0.25 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      data-statement-shown={isShown}
      className="relative isolate flex min-h-svh flex-col justify-center overflow-hidden bg-ink pt-16 text-ink-foreground"
    >
      <FeatherLattice className="opacity-[0.12]" tone="brand" />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-16 lg:px-10">
        <p className="statement-line text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
          Бидний тухай · About us
        </p>

        <h1 className="mt-8 font-semibold tracking-[-0.045em] uppercase">
          {LINES.map((line, index) => (
            <span
              key={line}
              className="statement-line block text-[10vw] leading-[0.9] sm:text-[6.4vw]"
              style={{ animationDelay: `${120 + index * 150}ms` }}
            >
              {line}
            </span>
          ))}
        </h1>

        <div
          className="statement-line mt-12"
          style={{ animationDelay: "640ms" }}
        >
          <GradientRule className="max-w-[7rem] rounded-full" />
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-muted text-pretty">
            1993 онд машин техникийн ард ажилладаг цөөхөн хүнээр эхэлсэн
            компани өнөөдөр Монгол улсын 21 аймагт түлш хүргэдэг. Гэхдээ бидний
            хамгийн чухал дэд бүтэц нь хүн хэвээрээ.
          </p>
        </div>

        <SectionRail
          items={anchors}
          label="Хуудасны хэсгүүд"
          className="statement-line mt-12"
          style={{ animationDelay: "760ms" }}
        />
      </div>
    </section>
  );
}
