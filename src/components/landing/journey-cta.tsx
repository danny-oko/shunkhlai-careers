import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ArcBloom } from "@/components/brand/arc-bloom";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";

/** Closing invitation. The last orange in the 10% budget for this page. */
export function JourneyCta({ roleCount }: { roleCount: number }) {
  return (
    <section className="relative isolate overflow-hidden border-t border-border/70">
      <ArcBloom className="-z-10" />

      <div className="mx-auto max-w-6xl px-6 py-24 lg:px-10 lg:py-32">
        <Reveal>
          <GradientRule className="max-w-[7rem] rounded-full" />
          <h2 className="mt-9 max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
            Дараагийн хөдөлгүүр нь та байх уу?
          </h2>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Анкет илгээхэд ердөө хэдхэн минут. CV-гээ хавсаргаад илгээхэд
            бүртгэл тань автоматаар үүсч, дараагийн удаа нэг товчоор өргөдөл
            гаргах боломжтой болно.
          </p>

          <div className="mt-11 flex flex-wrap items-center gap-3">
            <Button asChild className="h-11 rounded-full px-6 text-[0.9375rem]">
              <Link href="/careers">
                {roleCount} ажлын байр харах
                <ArrowRight className="ml-1 size-4 transition-transform group-hover/button:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full px-6 text-[0.9375rem]"
            >
              <Link href="/about">Соёлтой танилцах</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
