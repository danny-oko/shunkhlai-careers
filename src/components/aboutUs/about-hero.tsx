import { ArcBloom } from "@/components/brand/arc-bloom";
import { FeatherLattice } from "@/components/brand/feather-lattice";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Rise } from "@/components/brand/rise";

const anchors = [
  { href: "#history", label: "Бидний түүх" },
  { href: "#vision", label: "Алсын хараа" },
  { href: "#values", label: "Үнэт зүйл" },
  { href: "#academy", label: "Сургалт, хөгжил" },
  { href: "#benefits", label: "Хөнгөлөлт, хангамж" },
  { href: "#clubs", label: "Хобби клубууд" },
  { href: "#life", label: "Ажилтны түүх" },
];

export function AboutHero() {
  return (
    <section className="relative isolate overflow-hidden pt-16">
      <ArcBloom className="-z-10" />
      <FeatherLattice
        className="-z-10 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black_15%,transparent_100%)]"
        tone="brand"
      />

      <div className="mx-auto max-w-6xl px-6 pt-16 pb-16 sm:pt-24 lg:px-10">
        <Rise>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Бидний тухай · About us
          </p>
        </Rise>

        <Rise delay={90}>
          <h1 className="mt-6 max-w-4xl text-[2.6rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-7xl">
            Авто засварын багаас улс даяарх сүлжээ хүртэл
          </h1>
        </Rise>

        <Rise delay={200} className="mt-8">
          <GradientRule className="max-w-[7rem] rounded-full" />
        </Rise>

        <Rise delay={270}>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
            1993 онд машин техникийн ард ажилладаг цөөхөн хүнээр эхэлсэн
            компани өнөөдөр Монгол улсын 21 аймагт түлш хүргэдэг. Гэхдээ бидний
            хамгийн чухал дэд бүтэц нь хүн хэвээрээ.
          </p>
        </Rise>

        <Rise delay={360}>
          <ul className="mt-11 flex flex-wrap gap-2">
            {anchors.map((anchor) => (
              <li key={anchor.href}>
                <a
                  href={anchor.href}
                  className="inline-flex h-9 items-center rounded-full border border-border/80 px-4 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
                >
                  {anchor.label}
                </a>
              </li>
            ))}
          </ul>
        </Rise>
      </div>
    </section>
  );
}
