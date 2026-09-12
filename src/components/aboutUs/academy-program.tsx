import { GradientRule } from "@/components/brand/gradient-rule";
import { Reveal } from "@/components/reveal";

/**
 * Content plan 2.5. HR's detailed programme list is still to come, so this
 * carries their description and the two facts it states — nothing is invented
 * to fill the space.
 */
const pillars = [
  {
    title: "Гадны сургагч багш",
    body: "Салбартаа хүлээн зөвшөөрөгдсөн сургагч багш, сургалтын байгууллагууд.",
  },
  {
    title: "Дотоод сургагч багш",
    body: "Компанийн өөрийн сургагч багш нар мэдлэг, ур чадварын хөрөнгө оруулалтыг ажилтнууддаа хийдэг.",
  },
];

/**
 * Сургалт, хөгжил.
 *
 * Text only by design: the Academy posters run on the landing page, so
 * repeating one here would say the same thing twice.
 */
export function AcademyPanel() {
  return (
    <>
      <Reveal>
        <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
          Shunkhlai Academy
        </p>
        <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
          Ажилдаа сурч, ажил дээрээ өсдөг
        </h2>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-muted text-pretty">
          Компанийн үнэт зүйлс алсын хараа руу чиглэсэн мэдлэг, ур чадварыг
          хөгжүүлэх замаар хүний нөөцийн тасралтгүй залгамж халааг бэлтгэн
          ажилтанг чадваржуулах бодлого баримтлан ажилладаг.
        </p>
      </Reveal>

      <Reveal delay={140} className="mt-12">
        <GradientRule className="max-w-28 rounded-full" />
      </Reveal>

      <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
        {pillars.map((track, index) => (
          <Reveal
            as="li"
            key={track.title}
            delay={index * 90}
            className="border-t border-white/12 pt-6 transition-colors duration-500 hover:border-brand"
          >
            <span className="font-mono text-xs text-brand tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-4 text-lg font-medium tracking-[-0.015em]">
              {track.title}
            </h3>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-muted text-pretty">
              {track.body}
            </p>
          </Reveal>
        ))}
      </ul>
    </>
  );
}
