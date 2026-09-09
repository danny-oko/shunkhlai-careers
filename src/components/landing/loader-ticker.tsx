"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Row height, in rem. Must match the `h-5` on the window and each item. */
const ROW = 1.25;

/**
 * A single-line list that rolls through its items, one visible at a time.
 *
 * Pass `index` to drive it from outside — the opening loader ties the run of
 * province names to the same progress as its counter, so the two land
 * together. Leave it off and the list cycles on its own.
 */
export function LoaderTicker({
  items,
  index,
  intervalMs = 420,
  className,
}: {
  items: string[];
  index?: number;
  intervalMs?: number;
  className?: string;
}) {
  const [own, setOwn] = React.useState(0);
  const isControlled = index !== undefined;

  React.useEffect(() => {
    if (isControlled) return;
    const timer = window.setInterval(
      () => setOwn((current) => (current + 1) % items.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [isControlled, items.length, intervalMs]);

  const shown = isControlled ? index : own;

  return (
    <div
      aria-hidden
      className={cn("h-5 overflow-hidden font-mono text-xs", className)}
    >
      <ul
        className="transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(-${shown * ROW}rem)` }}
      >
        {items.map((item) => (
          <li
            key={item}
            className="flex h-5 items-center justify-center tracking-[0.08em] whitespace-nowrap uppercase"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
