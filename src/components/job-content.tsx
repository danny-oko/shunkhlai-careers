import {
  Briefcase,
  Building2,
  type LucideIcon,
  MapPin,
  Users,
} from "lucide-react";

import type { JobDetail } from "@/lib/jobs/types";
import { Reveal } from "@/components/reveal";
// import { CalendarPlus, CalendarClock } from "lucide-react";

type Fact = {
  label: string;
  value: string;
  icon: LucideIcon;
};

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
          key={`${index}-${item}`}
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

/**
 * The detail endpoint splits a posting into duties (`mainresp`) and
 * requirements (`mainreq`); either can come back empty, so each block only
 * renders when it has something to say.
 */
export function JobContent({ job }: { job: JobDetail }) {
  const facts = [
    job.company
      ? { label: "Компани", value: job.company, icon: Building2 }
      : null,
    job.location
      ? { label: "Байршил", value: job.location, icon: MapPin }
      : null,
    job.positionType
      ? { label: "Ажлын хэлбэр", value: job.positionType, icon: Briefcase }
      : null,
    job.quantity
      ? { label: "Авах хүний тоо", value: String(job.quantity), icon: Users }
      : null,
    // job.postedAt
    //   ? { label: "Зар нийтэлсэн", value: job.postedAt, icon: CalendarPlus }
    //   : null,
    // job.closesAt
    //   ? { label: "Зар хаагдах", value: job.closesAt, icon: CalendarClock }
    //   : null,
  ].filter((fact): fact is Fact => fact !== null);

  return (
    <div className="space-y-10 pb-4">
      <Section title="Ажлын байрны мэдээлэл">
        <Reveal delay={60}>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-1">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-[0.08em] uppercase">
                  <fact.icon aria-hidden className="size-3.5 shrink-0" />
                  {fact.label}
                </dt>
                <dd className="text-[0.9375rem] text-foreground/85">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Section>

      {job.responsibilities.length > 0 ? (
        <Section title="Гол үүрэг, хариуцлага">
          <BulletList items={job.responsibilities} />
        </Section>
      ) : null}

      {job.requirements.length > 0 ? (
        <Section title="Тавигдах шаардлага">
          <BulletList items={job.requirements} />
        </Section>
      ) : null}

      {job.additional ? (
        <Section title="Нэмэлт мэдээлэл">
          <Reveal delay={60}>
            <p className="text-[0.9375rem] leading-relaxed text-foreground/85 text-pretty">
              {job.additional}
            </p>
          </Reveal>
        </Section>
      ) : null}

      {job.mapUrl ? (
        <Section title="Байршил">
          <Reveal delay={60}>
            <a
              href={job.mapUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[0.9375rem] underline underline-offset-4"
            >
              Газрын зураг дээр харах
            </a>
          </Reveal>
        </Section>
      ) : null}
    </div>
  );
}
