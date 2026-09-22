"use client";

import * as React from "react";

import { LoaderLogo } from "@/components/landing/loader-logo";
import { LoaderTicker } from "@/components/landing/loader-ticker";
import { MongoliaMap } from "@/components/landing/mongolia-map";
import { useReducedMotion } from "@/components/landing/use-scroll-progress";
import { cn } from "@/lib/utils";

/** The count and the province names share this run and finish together. */
const COUNT_MS = 2000;
/** Beat between the count landing and the wordmark arriving. */
const NAME_AFTER_MS = 200;
/** How long the wordmark is read before it sets off for the header. */
const HOLD_MS = 700;
const FLIGHT_MS = 950;

/**
 * The company's divisions, as HR names them. Deliberately not the recruitment
 * API's position groups: this line is the company introducing itself, not a
 * readout of whatever happens to be hiring.
 */
const DIVISIONS = [
  "Захиргаа, Хүний нөөцийн газар",
  "Шуурхай зохицуулалтын алба",
  "Дотоод аудитын алба",
  "Борлуулалт, Маркетингийн газар",
  "Гадаад худалдаа, худалдан авалтын алба",
  "Бизнес технологийн газар",
  "Техник технологийн газар",
  "Санхүүгийн газар",
];

type Phase = "counting" | "naming" | "flying" | "done";

/**
 * Opening screen, shown on every load of the landing page.
 *
 * The counter and the list of provinces run off one clock, so they land on
 * 100 and on the last province together. The wordmark then arrives over the
 * map, the panels sweep the screen away behind it, and it flies into the
 * header's brand where the page takes over.
 *
 * `provinces` is the recruitment system's own location list, handed down from
 * the page. It can arrive empty if the API is unreachable, and the screen
 * simply drops that line.
 *
 * Page scrolling is held for the ~3.9s this takes and released on the way
 * out, including if the component is unmounted early.
 */
export function SiteLoader({ provinces }: { provinces: string[] }) {
  const isReduced = useReducedMotion();
  const [progress, setProgress] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("counting");

  React.useEffect(() => {
    if (isReduced) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const release = () => {
      document.body.style.overflow = overflow;
    };

    let frame = 0;
    const timers: number[] = [];
    const start = performance.now();

    const tick = (now: number) => {
      const run = Math.min((now - start) / COUNT_MS, 1);
      // easeOutQuart, so the number sprints then eases onto 100.
      setProgress(1 - Math.pow(1 - run, 4));

      if (run < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      timers.push(
        window.setTimeout(() => setPhase("naming"), NAME_AFTER_MS),
        window.setTimeout(() => setPhase("flying"), NAME_AFTER_MS + HOLD_MS),
        window.setTimeout(() => {
          release();
          setPhase("done");
        }, NAME_AFTER_MS + HOLD_MS + FLIGHT_MS),
      );
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      for (const timer of timers) window.clearTimeout(timer);
      release();
    };
  }, [isReduced]);

  if (isReduced || phase === "done") return null;

  const isCounting = phase === "counting";
  const isFlying = phase === "flying";
  const count = Math.round(progress * 100);
  const province = Math.min(
    Math.round(progress * Math.max(provinces.length - 1, 0)),
    Math.max(provinces.length - 1, 0),
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-70 overflow-hidden"
    >
      {[0, 1, 2].map((panel) => (
        <div
          key={panel}
          className={cn(
            "absolute top-0 bottom-0 w-1/3 bg-background",
            isFlying && "loader-panel-out",
          )}
          style={{
            left: `${panel * 33.34}%`,
            animationDelay: `${panel * 90}ms`,
          }}
        />
      ))}

      <div className="absolute inset-0 flex flex-col justify-between px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex flex-1 items-center">
          <div className="relative mx-auto w-full max-w-3xl">
            <MongoliaMap
              className="transition-opacity duration-500"
              style={{ opacity: isCounting ? 1 : 0 }}
            />

            {/* Both readouts sit over the country rather than in the corners. */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity duration-300"
              style={{ opacity: isCounting ? 1 : 0 }}
            >
              <span className="font-mono text-5xl leading-none font-medium tabular-nums sm:text-7xl">
                {String(count).padStart(3, "0")}
              </span>
              {provinces.length > 0 && (
                <LoaderTicker
                  items={provinces}
                  index={province}
                  className="text-muted-foreground"
                />
              )}
            </div>

            {/* Takes the same centre once the two readouts have finished. */}
            <div className="absolute inset-0 flex items-center justify-center">
              <LoaderLogo
                visible={!isCounting}
                flying={isFlying}
                durationMs={FLIGHT_MS}
              />
            </div>
          </div>
        </div>

        <div
          className="flex justify-end transition-opacity duration-300"
          style={{ opacity: isCounting ? 1 : 0 }}
        >
          <LoaderTicker
            items={DIVISIONS}
            intervalMs={520}
            className="text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}
