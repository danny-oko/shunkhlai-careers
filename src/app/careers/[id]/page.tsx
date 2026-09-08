import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApplyProvider } from "@/components/apply-provider";
import { JobStickyHeader } from "@/components/job-sticky-header";
import { JobHeader } from "@/components/job-header";
import { JobContent } from "@/components/job-content";
import { ApplyButton } from "@/components/apply-button";
import { getAllJobIds, getJobById } from "@/lib/mock-jobs";

export function generateStaticParams() {
  return getAllJobIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/careers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = getJobById(id);

  if (!job) return { title: "Role not found" };

  return {
    title: job.title,
    description: job.summary,
  };
}

export default async function JobPage({ params }: PageProps<"/careers/[id]">) {
  const { id } = await params;
  const job = getJobById(id);

  if (!job) notFound();

  return (
    <ApplyProvider job={job}>
      <JobStickyHeader job={job} />

      <main className="flex-1">
        <JobHeader job={job} />

        <div className="mx-auto w-full max-w-4xl px-6 pt-16">
          <JobContent job={job} />

          <section className="my-16 border-t border-border/70 pt-12">
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
          </section>
        </div>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-4xl flex-col gap-1 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Shunkhlai Group LLC
          </p>
          <p className="text-sm text-muted-foreground">
            Ulaanbaatar, Mongolia
          </p>
        </div>
      </footer>
    </ApplyProvider>
  );
}
