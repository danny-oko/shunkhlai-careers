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
    description: [job.company, job.location, job.workType].filter(Boolean).join(" · "),
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

          {job.isOpen ? (
            <Reveal as="section" className="my-16 border-t border-border/70 pt-12">
              <h2 className="text-2xl font-semibold tracking-[-0.025em]">
                Анкетаа илгээх үү?
              </h2>
              <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
                Нэг удаа анкетаа бөглөснөөр бүх нээлттэй ажлын байранд хэдхэн товшилтоор
                өргөдөл гаргах боломжтой.
              </p>
              <ApplyButton
                size="lg"
                showIcon
                label="Анкет илгээх"
                className="mt-7 h-11 rounded-full px-6 text-[0.9375rem]"
              />
            </Reveal>
          ) : (
            <Reveal as="section" className="my-16 border-t border-border/70 pt-12">
              <h2 className="text-2xl font-semibold tracking-[-0.025em]">
                Энэ зарын хугацаа дууссан
              </h2>
              <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
                Тохирох ажлын байр нээгдэхэд мэдэгдэхийг хүсвэл анкетдаа сонирхож буй
                албан тушаалаа бүртгүүлээрэй.
              </p>
            </Reveal>
          )}
        </div>
      </main>
    </ApplyProvider>
  );
}
