import { Briefcase, MapPin, Wallet } from "lucide-react";
import type { Job } from "@/lib/mock-jobs";
import { ApplyButton } from "@/components/apply-button";

function Tag({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="size-3.5 shrink-0 text-muted-foreground/70" />
      {children}
    </span>
  );
}

export function JobHeader({ job }: { job: Job }) {
  return (
    <header className="pt-16 pb-12 sm:pt-24 sm:pb-16">
      <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {job.department}
      </p>

      <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl">
        {job.title}
      </h1>

      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
        {job.summary}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Tag icon={MapPin}>{job.location}</Tag>
        <Tag icon={Briefcase}>
          {job.type} · {job.experience}
        </Tag>
        {job.salary ? <Tag icon={Wallet}>{job.salary}</Tag> : null}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
        <ApplyButton
          size="lg"
          showIcon
          className="h-11 rounded-full px-6 text-[0.9375rem]"
        />
        <p className="text-sm text-muted-foreground">
          Takes about two minutes. No account needed.
        </p>
      </div>
    </header>
  );
}
