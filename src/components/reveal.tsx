"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Fades and lifts its children in the first time they enter the viewport.
 * Anything already on screen at load reveals immediately, so the fold is
 * never blank. Respects prefers-reduced-motion by showing content outright.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [isShown, setIsShown] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Without an element, an observer, or with motion turned down, show it.
    if (!element || prefersReduced || typeof IntersectionObserver === "undefined") {
      setIsShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
        isShown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
