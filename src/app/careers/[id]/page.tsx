import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApplyProvider } from "@/components/apply-provider";
import { JobStickyHeader } from "@/components/job-sticky-header";
import { JobHeader } from "@/components/job-header";
import { JobContent } from "@/components/job-content";
import { ApplyButton } from "@/components/apply-button";
import { Reveal } from "@/components/reveal";
import { getJob } from "@/lib/jobs";

/**
 * Postings open and close on the backend's schedule, so this route renders
 * per request rather than being prerendered from a build-time list. The `id`
 * segment is the posting's slug — `4-station-manager` — and `getJob` reads the
 * numeric entry id back out of it.
 */

/**
 * Postings are read with axios, which Next cannot see the way it sees `fetch`,
 * so without this the page would be prerendered once at build and serve the
 * same list forever. Five minutes: fresh enough for a careers site, cheap
 * enough that the recruitment API is not hit on every visit.
 * (Must stay a literal — the value has to be statically analysable.)
 */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/careers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) return { title: "Role not found" };

  return {
    title: job.title,
    description: job.summary,
  };
}

export default async function JobPage({ params }: PageProps<"/careers/[id]">) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) notFound();

  return (
    <ApplyProvider job={job}>
      <JobStickyHeader job={job} />

      <main className="flex-1">
        <JobHeader job={job} />

        <div className="mx-auto w-full max-w-4xl px-6 pt-16">
          <JobContent job={job} />

          <Reveal as="section" className="my-16 border-t border-border/70 pt-12">
            <h2 className="text-2xl font-semibold tracking-[-0.025em]">
              Ready to apply?
            </h2>
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
              Send us your details and CV. If you don&apos;t have a CV yet, tell
              us and our recruitment team will help you put one together.
            </p>
            <ApplyButton
              size="lg"
              showIcon
              className="mt-7 h-11 rounded-full px-6 text-[0.9375rem]"
            />
          </Reveal>
        </div>
      </main>
    </ApplyProvider>
  );
}
