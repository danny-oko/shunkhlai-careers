import type { Job } from "@/lib/mock-jobs";
import { Reveal } from "@/components/reveal";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/70 pt-10 first:border-t-0 first:pt-0">
      <Reveal>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      </Reveal>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3.5">
      {items.map((item, index) => (
        <Reveal
          as="li"
          key={item}
          delay={60 + Math.min(index, 8) * 60}
          className="flex gap-3.5 text-[0.9375rem] leading-relaxed"
        >
          <span
            aria-hidden
            className="mt-[0.6875rem] size-1 shrink-0 rounded-full bg-brand/70"
          />
          <span className="text-foreground/85 text-pretty">{item}</span>
        </Reveal>
      ))}
    </ul>
  );
}

export function JobContent({ job }: { job: Job }) {
  return (
    <div className="space-y-10 pb-4">
      <Section title="About the role">
        <Reveal delay={60}>
          <p className="text-[1.0625rem] leading-[1.75] text-foreground/85 text-pretty">
            {job.aboutRole}
          </p>
        </Reveal>
      </Section>

      <Section title="What you'll do">
        <BulletList items={job.responsibilities} />
      </Section>

      <Section title="What we're looking for">
        <BulletList items={job.requirements} />
      </Section>

      <Section title="What we offer">
        <BulletList items={job.benefits} />
      </Section>
    </div>
  );
}
