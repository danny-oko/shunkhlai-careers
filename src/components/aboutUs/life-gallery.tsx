import Image from "next/image";

import { Reveal } from "@/components/reveal";
import { stories } from "@/lib/culture";

/**
 * Ажилтны түүх — the full poster set, laid out rather than railed.
 *
 * The one 16:9 poster leads the section at full width; the 3:4 posters follow
 * in a grid. Nothing is cropped, so the client's artwork stays intact.
 */
export function LifeGallery() {
  const lead = stories.find((story) => story.shape === "wide");
  const portraits = stories.filter((story) => story.shape === "portrait");

  return (
    <section
      id="life"
      className="scroll-mt-20 border-t border-border/70 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Ажилтны түүх · Life at Shunkhlai
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Дээд амжилтууд хүнээр хэмжигддэг
          </h2>
        </Reveal>

        {lead && (
          <Reveal delay={120} className="mt-12">
            <figure>
              <div className="overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={lead.src}
                  alt={lead.alt}
                  width={1920}
                  height={1006}
                  sizes="(max-width: 1024px) 100vw, 72rem"
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-base font-medium tracking-[-0.01em]">
                  {lead.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {lead.role}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        )}

        <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {portraits.map((story, index) => (
            <Reveal as="li" key={story.src} delay={index * 100}>
              <figure className="group">
                <div className="overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={story.src}
                    alt={story.alt}
                    width={1080}
                    height={1350}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 22rem"
                    className="h-auto w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <figcaption className="mt-5">
                  <p className="text-base font-medium tracking-[-0.01em]">
                    {story.name}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {story.role}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {story.highlight}
                  </p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
