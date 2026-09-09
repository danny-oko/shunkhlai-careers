import Image from "next/image";

import { FeatherLattice } from "@/components/brand/feather-lattice";
import { Reveal } from "@/components/reveal";
import { academyVoices } from "@/lib/culture";

/**
 * Shunkhlai Academy — colleagues' advice, on a slow rail.
 *
 * The posters are the client's artwork with the quote set into them, so they
 * are shown whole. The track renders the set twice for a seamless loop; the
 * second copy is hidden from assistive tech so nothing is announced twice,
 * and hovering the rail pauses it long enough to read a card.
 */
export function AcademyVoices() {
  return (
    <section
      id="academy-voices"
      className="relative isolate overflow-hidden bg-ink py-20 text-ink-foreground lg:py-28"
    >
      <FeatherLattice className="opacity-[0.16]" tone="brand" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
            Shunkhlai Academy
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
            Түрүүлж эхэлсэн хүмүүсийн зөвлөгөө
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted text-pretty">
            Академийн хөтөлбөрт хамрагдсан ажилтнууд шинээр ажилд орж буй
            хүмүүст юу хэлэх вэ.
          </p>
        </Reveal>
      </div>

      <div className="brand-marquee-group relative mt-14 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
        {/* The gap lives inside each copy (`gap-5 pr-5`) rather than between
            them, so translating the track by exactly -50% lands on a seam. */}
        <div
          className="brand-marquee flex w-max"
          style={{ "--marquee-duration": "60s" } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              className="flex shrink-0 gap-5 pr-5"
              aria-hidden={copy === 1}
            >
              {academyVoices.map((voice) => (
                <li
                  key={voice.src}
                  className="w-[70vw] shrink-0 sm:w-[19rem]"
                >
                  <figure>
                    <div className="overflow-hidden rounded-2xl bg-ink-2">
                      <Image
                        src={voice.src}
                        alt={
                          copy === 1
                            ? ""
                            : `${voice.name}, ${voice.role}: «${voice.quote}»`
                        }
                        width={1080}
                        height={1350}
                        sizes="(max-width: 640px) 70vw, 19rem"
                        className="h-auto w-full"
                      />
                    </div>
                    <figcaption className="mt-4 text-sm">
                      <span className="font-medium">{voice.name}</span>
                      <span className="mt-0.5 block text-ink-muted">
                        {voice.role}
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
