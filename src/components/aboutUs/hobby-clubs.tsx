import { Reveal } from "@/components/reveal";
import { clubs } from "@/lib/culture";

/**
 * Хобби клубууд.
 *
 * Deliberately light: the brief puts clubs in phase two, so this is a legible
 * text block today that a richer, photo-led section can replace later.
 */
export function HobbyClubs() {
  return (
    <section
      id="clubs"
      className="scroll-mt-20 border-t border-border/70 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Хобби клубууд · Clubs
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Ажлын дараа хамт байдаг шалтгаанууд
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Клубуудыг ажилтнууд өөрсдөө санаачилж, өөрсдөө удирддаг. Шинэ клуб
            нээх санал ирвэл хүний нөөцийн баг дэмжинэ.
          </p>
        </Reveal>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club, index) => (
            <Reveal as="li" key={club.name} delay={index * 70}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border/80 p-6 transition-colors duration-500 hover:border-brand/40">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                  style={{ backgroundImage: "var(--brand-gradient)" }}
                />
                <h3 className="text-lg font-medium tracking-[-0.015em]">
                  {club.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {club.nameEn}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {club.note}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
