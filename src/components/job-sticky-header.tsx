"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Job } from "@/lib/mock-jobs";
import { ApplyButton } from "@/components/apply-button";
import { cn } from "@/lib/utils";

/**
 * Sticky top bar. The wordmark and back link are always visible; the job
 * title and Apply button fade in once the reader has scrolled past the hero.
 */
export function JobStickyHeader({ job }: { job: Job }) {
  const [isCondensed, setIsCondensed] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setIsCondensed(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-40">
        <div
          className={cn(
            "border-b bg-background/80 backdrop-blur-md transition-colors duration-200",
            isCondensed ? "border-border/70" : "border-transparent",
          )}
        >
          <div className="mx-auto flex h-16 max-w-4xl items-center gap-4 px-6">
            <Link
              href="/careers"
              className="inline-flex shrink-0 items-center gap-2 text-sm font-medium tracking-[-0.01em] transition-colors hover:text-muted-foreground"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Shunkhlai Careers</span>
              <span className="sm:hidden">Careers</span>
            </Link>

            <div
              aria-hidden={!isCondensed}
              className={cn(
                "min-w-0 flex-1 transition-all duration-200",
                isCondensed
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-1 opacity-0",
              )}
            >
              <p className="truncate text-center text-sm font-medium tracking-[-0.01em]">
                {job.title}
              </p>
            </div>

            <div
              className={cn(
                "ml-auto shrink-0 transition-all duration-200",
                isCondensed
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-1 opacity-0",
              )}
            >
              <ApplyButton
                size="sm"
                label="Apply"
                tabIndex={isCondensed ? undefined : -1}
                className="h-8 rounded-full px-4"
              />
            </div>
          </div>
        </div>
    </div>
  );
}
