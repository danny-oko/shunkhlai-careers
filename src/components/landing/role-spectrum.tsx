import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { FieldMarquee } from "@/components/landing/field-marquee";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Reveal } from "@/components/reveal";
import { careerFields } from "@/lib/company";

/**
 * The brief's central message: Shunkhlai hires far more than station staff.
 *
 * Two rails moving in opposite directions carry the professional tracks past
 * the reader — they run edge to edge, outside the text column — and the grid
 * underneath says what each one actually does.
 */
export function RoleSpectrum() {
  const names = careerFields.map((field) => field.name);
  const half = Math.ceil(names.length / 2);

  return (
    <section className="border-t border-border/70 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Мэргэжлийн чиглэл · Career fields
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Зөвхөн шатахуунчин биш
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Колонкын ард ажилладаг хүмүүсийн хажууд химич, инженер, шинжээч,
            хөгжүүлэгч, маркетер, хуульч ажилладаг. Шунхлайд карьераа эхлүүлэх,
            эсвэл өөр чиглэл рүү шилжих олон зам бий.
          </p>
        </Reveal>
      </div>

      <Reveal delay={120} className="mt-14 space-y-4 text-foreground/85">
        <FieldMarquee items={names.slice(0, half)} durationSeconds={38} />
        <FieldMarquee items={names.slice(half)} durationSeconds={46} reverse />
      </Reveal>

      <div className="mx-auto mt-16 max-w-6xl px-6 lg:px-10">
        <GradientRule className="max-w-[7rem] rounded-full" />

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {careerFields.map((field, index) => (
            <Reveal
              as="li"
              key={field.name}
              delay={80 + (index % 4) * 70}
              className="border-t border-border pt-6 transition-colors duration-500 hover:border-brand"
            >
              <p className="text-base font-medium tracking-[-0.01em]">
                {field.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {field.nameEn}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                {field.blurb}
              </p>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={220}>
          <Link
            href="/careers"
            className="mt-12 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-brand transition-colors hover:text-brand-2"
          >
            Бүх нээлттэй ажлын байрыг үзэх
            <ArrowUpRight className="size-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
