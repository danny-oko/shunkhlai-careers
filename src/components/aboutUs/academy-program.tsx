import { GradientRule } from "@/components/brand/gradient-rule";
import { Reveal } from "@/components/reveal";

/** TODO(HR): confirm the programme list and durations before launch. */
const tracks = [
  {
    title: "Шинэ ажилтны хөтөлбөр",
    body: "Эхний өдрөөс эхлэн аюулгүй ажиллагаа, бүтээгдэхүүн, үйлчилгээний стандартын дадлагажуулалт.",
  },
  {
    title: "Мэргэжлийн гэрчилгээжүүлэлт",
    body: "Лаборатори, тээвэр, техник ашиглалтын чиглэлийн албан ёсны сертификатын дэмжлэг.",
  },
  {
    title: "Манлайллын хөтөлбөр",
    body: "Багийн ахлагч, станцын эрхлэгч болох замд бэлтгэх удирдлагын сургалт.",
  },
  {
    title: "Дотоод менторшип",
    body: "Туршлагатай ажилтан шинэ хүнтэй хосолж, эхний зургаан сард дагалдан ажиллана.",
  },
];

/**
 * Сургалт, хөгжил.
 *
 * Text only by design: the Academy posters run on the landing page, so
 * repeating one here would say the same thing twice.
 */
export function AcademyProgram() {
  return (
    <section
      id="academy"
      className="scroll-mt-20 border-t border-border/70 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Сургалт, хөгжил · Shunkhlai Academy
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Ажилдаа сурч, ажил дээрээ өсдөг
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Шунхлай Академи бол ажилтны ур чадварыг системтэй хөгжүүлэх дотоод
            сургалтын хөтөлбөр. ШТС-ын эрхлэгчээс захирал болтол өссөн замууд
            энэ байгууллагад бодитоор бий.
          </p>
        </Reveal>

        <Reveal delay={140} className="mt-12">
          <GradientRule className="max-w-[7rem] rounded-full" />
        </Reveal>

        <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {tracks.map((track, index) => (
            <Reveal
              as="li"
              key={track.title}
              delay={index * 90}
              className="border-t border-border pt-6 transition-colors duration-500 hover:border-brand"
            >
              <span className="font-mono text-xs text-brand tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-lg font-medium tracking-[-0.015em]">
                {track.title}
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground text-pretty">
                {track.body}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
