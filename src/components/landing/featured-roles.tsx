import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/jobs/types";

/** One role per position group, so the shortlist reads as a range, not a list. */
function pickFeatured(jobs: Job[], count = 3) {
  const seen = new Set<string>();
  return jobs
    .filter((job) => job.isOpen)
    .filter((job) => {
      if (seen.has(job.positionGroup)) return false;
      seen.add(job.positionGroup);
      return true;
    })
    .slice(0, count);
}

export function FeaturedRoles({ jobs }: { jobs: Job[] }) {
  const featured = pickFeatured(jobs);

  return (
    <section className="border-t border-border/70 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Онцлох ажлын байр · Featured roles
            </p>
            <h2 className="mt-5 max-w-2xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
              Одоо хүн хайж буй багууд
            </h2>
          </div>
          <Button asChild variant="outline" className="h-10 rounded-full px-5">
            <Link href="/careers">Бүгдийг үзэх</Link>
          </Button>
        </Reveal>

        <ul className="mt-12 grid gap-5 lg:grid-cols-3">
          {featured.map((job, index) => (
            <Reveal as="li" key={job.id} delay={index * 110}>
              <Link
                href={`/careers/${job.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--brand)_60%,transparent)]"
              >
                {/* The brandbook кант, revealed along the top edge on hover. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                  style={{ backgroundImage: "var(--brand-gradient)" }}
                />

                <div className="flex items-start justify-between gap-4">
                  <Badge variant="secondary" className="h-6 px-2.5">
                    {job.positionGroup}
                  </Badge>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                </div>

                <h3 className="mt-5 text-xl leading-tight font-semibold tracking-[-0.025em]">
                  {job.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {job.company}
                  {job.remainingDays >= 0
                    ? ` · зар хаагдахад ${job.remainingDays} хоног`
                    : ""}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {job.location}
                  </span>
                  <span>{job.workType}</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
