import Link from "next/link";
import { Clock, Globe, TrendingUp, Users, Wallet } from "lucide-react";
import type { Job } from "@/lib/jobs/types";
import { ApplyButton } from "@/components/apply-button";
import { ArcBloom } from "@/components/brand/arc-bloom";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Rise } from "@/components/brand/rise";
import { cn } from "@/lib/utils";

function HeroGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, var(--grid-line) 0 1px, transparent 1px var(--grid-cell)), repeating-linear-gradient(to bottom, var(--grid-line) 0 1px, transparent 1px var(--grid-cell))",
          backgroundPosition: "center",
          maskImage:
            "radial-gradient(ellipse 78% 68% at 50% 42%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 78% 68% at 50% 42%, black 30%, transparent 100%)",
        }}
      />
    </div>
  );
}

/** The small registration marks that sit on the hero's corner intersections. */
function Crosshair({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className={cn(
        "absolute hidden size-3.5 -translate-x-1/2 -translate-y-1/2 text-foreground/25 sm:block",
        className,
      )}
    >
      <path d="M7 0v14M0 7h14" />
    </svg>
  );
}

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0 text-muted-foreground/60" />
      {children}
    </span>
  );
}

export function JobHeader({ job }: { job: Job }) {
  return (
    <header className="relative isolate border-b border-border/70 [--grid-cell:5.5rem] [--grid-line:color-mix(in_oklab,var(--foreground)_7%,transparent)] sm:[--grid-cell:7rem]">
      <HeroGrid />
      <ArcBloom className="-z-10" />

      <div className="relative mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
        <Crosshair className="top-0 left-0" />
        <Crosshair className="top-0 left-full" />
        <Crosshair className="top-full left-0" />
        <Crosshair className="top-full left-full" />

        <Rise>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <MetaItem icon={Users}>{job.department}</MetaItem>
            <MetaItem icon={Globe}>{job.location}</MetaItem>
            <MetaItem icon={Clock}>{job.type}</MetaItem>
          </div>
        </Rise>

        <Rise delay={100}>
          <h1 className="mt-9 text-[2.75rem] leading-[0.95] font-semibold tracking-[-0.04em] text-balance sm:mt-11 sm:text-6xl lg:text-[4.25rem]">
            {job.title}
          </h1>
        </Rise>

        <Rise delay={190} className="mt-9 flex justify-center sm:mt-11">
          <GradientRule className="max-w-[5rem] rounded-full" />
        </Rise>

        <nav aria-label="Breadcrumb" className="brand-rise mt-9 text-sm [animation-delay:260ms]">
          <Link
            href="/careers"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Careers
          </Link>
          <span aria-hidden className="px-2 text-muted-foreground/40">
            /
          </span>
          <span className="font-medium">{job.department}</span>
        </nav>
      </div>

      <div className="relative mx-auto max-w-2xl px-6 pb-16 text-center sm:pb-20">
        <Rise delay={330}>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            {job.summary}
          </p>
        </Rise>

        <Rise delay={400}>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <MetaItem icon={TrendingUp}>{job.experience}</MetaItem>
            {job.salary ? <MetaItem icon={Wallet}>{job.salary}</MetaItem> : null}
          </div>
        </Rise>

        <Rise delay={470} className="mt-10 flex flex-col items-center gap-3">
          <ApplyButton
            size="lg"
            showIcon
            className="h-11 rounded-full px-7 text-[0.9375rem]"
          />
          <p className="text-sm text-muted-foreground">
            Takes about two minutes. No account needed.
          </p>
        </Rise>
      </div>
    </header>
  );
}
