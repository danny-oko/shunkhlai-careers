"use client";

import * as React from "react";

import { FeatherLattice } from "@/components/brand/feather-lattice";
import { SectionRule } from "@/components/brand/section-rule";
import { SectionRail } from "@/components/aboutUs/section-rail";
import { VisionPanel } from "@/components/aboutUs/vision-mission";
import { ValuesPanel } from "@/components/aboutUs/core-values";
import { AcademyPanel } from "@/components/aboutUs/academy-program";
import { BenefitsPanel } from "@/components/aboutUs/benefits-grid";
import { ClubsPanel } from "@/components/aboutUs/hobby-clubs";
import { cn } from "@/lib/utils";

const ID = "culture";

/**
 * The keys are the hashes the five used to be their own sections under, so
 * every link already written against them — the hero's rail, the site footer —
 * still arrives at the right place and opens the right panel.
 */
const TABS = [
  { key: "vision", label: "Алсын хараа", panel: <VisionPanel /> },
  { key: "values", label: "Үнэт зүйл", panel: <ValuesPanel /> },
  { key: "academy", label: "Сургалт, хөгжил", panel: <AcademyPanel /> },
  { key: "benefits", label: "Хөнгөлөлт, хангамж", panel: <BenefitsPanel /> },
  { key: "clubs", label: "Хобби клубууд", panel: <ClubsPanel /> },
];

/**
 * Vision, values, academy, benefits and clubs as one panel with five faces.
 *
 * As five separate sections they were five screens of scrolling that all said
 * "here is another thing about working here", and the ink ground alternated in
 * and out under them. Held on one ink panel with a track across the top, the
 * five read as what they are — five sides of the same subject — and the page
 * gets its rhythm back: one dark block between the history above and the
 * people below.
 *
 * The panels are laid over each other rather than swapped, and the box they
 * sit in is given the height of whichever is showing. That is what lets the
 * outgoing one leave while the incoming one arrives, and what stops the rest
 * of the page jumping when a short panel follows a tall one.
 */
export function CultureSection() {
  const [active, setActive] = React.useState(0);
  const [height, setHeight] = React.useState<number>();
  const panels = React.useRef<(HTMLDivElement | null)[]>([]);

  // Before the first measurement the showing panel is left in the flow, so the
  // section has its true height in the server's HTML and with no JS at all.
  // This runs before paint, so the swap to the measured box is never seen.
  const measured = height !== undefined;

  React.useLayoutEffect(() => {
    const panel = panels.current[active];
    if (!panel) return;

    const measure = () => setHeight(panel.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [active]);

  React.useEffect(() => {
    // A link from elsewhere on the site names a panel by its old hash.
    const open = () => {
      const index = TABS.findIndex((tab) => `#${tab.key}` === location.hash);
      if (index >= 0) setActive(index);
    };

    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  return (
    <section
      id={ID}
      className="relative isolate overflow-hidden bg-ink py-20 text-ink-foreground lg:py-28"
    >
      <SectionRule />
      <FeatherLattice className="opacity-[0.16]" tone="brand" />

      {/* One landing point per old section, so nothing that already links here
          has to know the five were folded together. */}
      {TABS.map((tab) => (
        <span
          key={tab.key}
          id={tab.key}
          aria-hidden
          className="absolute top-0 block h-0 scroll-mt-20"
        />
      ))}

      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
          Ажиллах орчин · Working here
        </p>

        <SectionRail
          items={TABS}
          selected={active}
          onSelect={setActive}
          idPrefix={ID}
          label="Ажиллах орчны хэсгүүд"
          className="mt-8"
        />

        <div
          className="relative mt-14 transition-[height] duration-500 ease-out motion-reduce:transition-none"
          style={{ height }}
        >
          {TABS.map((tab, index) => (
            <div
              key={tab.key}
              ref={(node) => {
                panels.current[index] = node;
              }}
              id={`${ID}-panel-${tab.key}`}
              role="tabpanel"
              aria-labelledby={`${ID}-tab-${tab.key}`}
              inert={index !== active}
              className={cn(
                "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
                index === active && !measured
                  ? "relative"
                  : "absolute inset-x-0 top-0",
                index === active
                  ? "translate-x-0 opacity-100"
                  : cn(
                      "pointer-events-none opacity-0",
                      // Leaves towards the side it sits on in the track, so the
                      // movement always agrees with the marker's direction.
                      index < active ? "-translate-x-8" : "translate-x-8",
                    ),
              )}
            >
              {tab.panel}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
