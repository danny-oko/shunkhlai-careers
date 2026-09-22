"use client";

import * as React from "react";

import { FeatherLattice } from "@/components/brand/feather-lattice";
import { SectionRule } from "@/components/brand/section-rule";
import { SectionRail } from "@/components/aboutUs/section-rail";
import { SphereGallery } from "@/components/aboutUs/sphere-gallery";
import { FiguresPanel } from "@/components/aboutUs/academy-principle";
import { BrandLockup } from "@/components/brand/brand-logo";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { clubCount, clubs } from "@/lib/culture";

const ID = "culture";

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
/** Still at both ends, quickest in the middle. */
const advance = (t: number) => t * t * (3 - 2 * t);
/** Away quickly, settling in. What arrives on screen takes it. */
const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * Three beats of turning, then one of gathering.
 *
 * The wall has been all the way round by the end of the third, and what
 * followed used to be the next section arriving over a sphere still turning
 * under it. On the fourth the pictures come home instead: they close on the
 * middle of the stage, the company's own mark is standing where they met, and
 * the Academy's figures for the year come up behind it.
 *
 * On the Academy wall, and only there. The figures are that wall's own - the
 * year's training, in one line and four numbers - and the gathering is what
 * hands them over, so on the other three it would be the pictures of somebody
 * else's subject closing on somebody else's total. Those walls simply keep
 * turning through the fourth beat.
 */
const BEATS = 4;
const CLOSES = "academy";

/** The gathering beat, as shares of itself. */
const GATHER = 0.42;
const MARK = { from: 0.24, span: 0.28 };
const FIGURES = { from: 0.5, span: 0.32 };

/**
 * The walls.
 *
 * `body` is what the dialog shows when a picture is opened. The words are
 * HR's own throughout: the Academy wall is their September write-up, the
 * benefits wall the content plan, and the clubs wall their roster. Where a
 * tile has no `body` yet it shows a standing note rather than invented copy.
 *
 * The pictures are HR's own too. The Academy wall carries the photographs
 * they sent of the training hall and its programmes, the benefits wall the
 * wellbeing sessions, and the clubs wall each club's lockup - with the club's
 * own photograph behind it where one was delivered.
 *
 * TODO(HR): the remaining entries without a `body` on the benefits wall are
 * waiting for the rest of the package.
 *
 * The keys are the hashes these used to be their own sections under, so every
 * link already written against them - the site footer - still arrives at the
 * right place and opens the right wall. The vision and the values left for
 * <StatementBands> above and took their hashes with them.
 *
 * There was a fourth wall here, "Урмын үгс": the five Academy posters, each a
 * person with a quote for anyone starting out. It was taken out at the
 * client's request, artwork and all - see the note left in lib/culture.
 */
const TABS = [
  {
    key: "academy",
    label: "Сургалт, хөгжил",
    // Шунхлай Академи, as HR's own write-up tells it: the hall, the people who
    // teach in it, the platform that carries it to everyone who is not in the
    // room, and the figures the year closed on.
    wall: [
      {
        title: "Шунхлай Академи",
        subtitle: "Shunkhlai Academy",
        body: "Мэдлэгээ хуваалцаж, хамтдаа хөгжих орон зай. 2023 онд зориулалтын сургалтын танхим ашиглалтад орсноор сургалт, хөгжлийн хөтөлбөрүүдийг нэг дор төвлөрүүлэн зохион байгуулах, ажилтнууд харилцан суралцаж, туршлагаа хуваалцах өөрийн гэсэн орон зай бүрдсэн.",
        image: "/academy/hall.jpg",
      },
      {
        title: "68 дотоод сургагч багш",
        subtitle: "Мэдлэгээ хуваалцахын үнэ цэн",
        body: "Компанийн хэмжээнд 68 дотоод сургагч багш мэргэжлийн мэдлэг, ажлын туршлагаа хамт олонтойгоо хуваалцан ажиллаж байна. Тэднийг хоёр жил тутам үе шаттайгаар бэлтгэдэг бөгөөд сургалтын агуулга дамжуулахаас гадна байгууллагын олон жилд хуримтлагдсан практик мэдлэгийг дараагийн ажилтнуудад хүргэх үүрэг гүйцэтгэдэг.",
        image: "/academy/trainer.jpg",
      },
      {
        title: "edu.shunkhlai.mn",
        subtitle: "Дотоод цахим сургалтын платформ",
        body: "Ажилтан байршлаасаа үл хамааран суралцах дижитал мэдлэгийн сан. Одоогийн байдлаар 192 видео хичээл байршсан бөгөөд мэргэжлийн, техникийн сургалтаас гадна сонгон судлах агуулга, сэтгэл зүйн эрүүл мэндийг дэмжих хичээлүүд багтдаг. Ажилтнууд дотоод шалгалтаа өгөх, судалгаанд хамрагдах боломжтой.",
        image: "/academy/classroom.jpg",
      },
      {
        title: "LinkedIn Learning",
        subtitle: "20 мянга гаруй сургалт",
        body: "Олон улсын сургалтын сан ажилтнуудад нээлттэй. Дотоодод хуримтлагдсан мэргэжлийн мэдлэгийг олон улсын агуулгатай хослуулснаар ажилтан бүр өөрийн хэрэгцээ, сонирхол, хөгжлийн зорилгодоо нийцсэн сургалтыг сонгон суралцах боломжтой.",
        image: "/academy/team.jpg",
      },
      {
        title: "Хөгжлийн 70/20/10 зарчим",
        // No "see below" any more: the principle is drawn at the end of
        // <StatementBands>, which is above this section, so the tile says what
        // it is and the reader meets the picture of it on the way in.
        body: "Ажилтныг зөвхөн сургалтад хамруулах бус, ажлын бодит туршлага (70%), хамтын суралцах үйл явц (20%), системтэй сургалтыг (10%) хослуулан хөгжүүлдэг.",
        image: "/academy/open-day.jpg",
      },
      {
        title: "Manager's Development Program",
        subtitle: "Дунд шатны менежерүүдийн хөтөлбөр",
        body: "Удирдлага, манлайллын хөгжлийн хөтөлбөрүүдийн нэг. 2025 оны төгсөгчид хөтөлбөрөө амжилттай дүүргэж, гэрчилгээгээ гардан авлаа.",
        image: "/academy/mdp-2025.jpg",
      },
      {
        title: "AI & Innovation",
        subtitle: "Ирээдүйн ур чадвар",
        body: "Сургалтын агуулгыг технологийн өөрчлөлт, ирээдүйд шаардлагатай ур чадвартай нягт уялдуулж AI & Innovation, Lead with AI, Excel & Power BI зэрэг хөтөлбөрүүдийг хэрэгжүүлж байна. Энэ нь ажилтнуудаа өнөөдрийн ажлаас гадна ирээдүйн өөрчлөлтөд бэлтгэхэд чиглэдэг.",
        image: "/academy/classroom.jpg",
      },
      {
        title: "Шинэ ажилтны чиглүүлэх хөтөлбөр",
        body: "Ажилтан компанид анх орсон үеэс эхлэн ажлын байрандаа мэргэших, ур чадвараа тасралтгүй хөгжүүлэх, цаашлаад менежер, манлайлагч болон өсөх замыг үе шаттайгаар дэмждэг.",
        image: "/academy/new-joiners.jpg",
      },
      {
        title: "Мэргэжлийн болон техникийн сургалт",
        body: "Газрын тосны салбарын мэргэжлийн сургалт, ХАБЭА, ШТС-ын ур чадварын хөтөлбөрүүд. Төгсөгчид мэргэжлийн гэрчилгээгээ гардан авдаг.",
        image: "/academy/station-skills.jpg",
      },
      {
        title: "Coaching, mentoring",
        body: "Business English, удирдлага ба манлайлал, дотоод сургагч багш бэлтгэх сургалт, coaching, mentoring зэрэг олон хэлбэрээр ажилтны хөгжлийг дэмждэг.",
        image: "/academy/certificates.jpg",
      },
      {
        title: "Хөгжил тоон үзүүлэлтээр",
        subtitle: "2026",
        body: "10,029 сургалтын хамрагдалт, 13,883 цагийн сургалт, 4,197 зохион байгуулсан сургалт, сургалтын дараах дундаж үнэлгээ 90.7 хувь. Эдгээр тоо нь компанийн хэмжээнд суралцах боломж хэр өргөн хүрээнд бий болж, ажилтнууд хэр идэвхтэй оролцож байгааг харуулдаг.",
        image: "/academy/open-day.jpg",
      },
      {
        title: "BUILD → DEVELOP → IMPACT",
        subtitle: "Дараагийн гурван жил",
        body: "Байгууллага болон ажилтнуудад ирээдүйд шаардлагатай ур чадвар, чадамжийг тодорхойлж, зорилготойгоор хөгжүүлэхийн зэрэгцээ суралцах үйл ажиллагааг ажилтан, баг, байгууллагын түвшинд бодит өөрчлөлт, үнэ цэн бий болгохтой улам нягт уялдуулна.",
        image: "/academy/hall.jpg",
      },
    ],
  },
  {
    key: "benefits",
    label: "Хөнгөлөлт, хангамж",
    wall: [
      {
        title: "Гэр бүлийн өдөр",
        subtitle: "Family day",
        body: "Жилд 1 өдрийн цалинтай чөлөө.",
      },
      {
        title: "Эрүүл мэндийн өдөр",
        subtitle: "Health day",
        body: "Жилд 2 өдрийн цалинтай чөлөө.",
      },
      {
        title: "Сэтгэл зүйн эрүүл мэнд",
        subtitle: "Employee wellbeing",
        body: "Сэтгэл зүйн эрүүл мэндээ хамгаалах нь ажилтны сайн сайхан байдлын үндэс. Шунхлай ХХК нь ажилтнуудынхаа сайн сайхан байдал, сэтгэл зүйн эрүүл мэндийг дэмжих чиглэлээр тогтмол сургалт, хөгжлийн хөтөлбөрүүдийг хэрэгжүүлдэг.",
        image: "/benefits/wellbeing-talk.jpg",
      },
      {
        title: "Optimal Nmax хамтын ажиллагаа",
        subtitle: "Сэтгэл зүйн эрүүл мэндийг дэмжих хөтөлбөр",
        body: "Employee Wellbeing хөтөлбөрийн хүрээнд мэргэжлийн байгууллагатай хамтран ажиллаж, ажилтнуудад сэтгэл зүйн дэмжлэг үзүүлэх тогтолцоог бүрдүүлж байна.",
        image: "/benefits/wellbeing-partnership.jpg",
      },
      {
        title: "Хамт олны уулзалт",
        body: "Сэтгэл зүйн эрүүл мэндийг дэмжих хөтөлбөрийн уулзалт, хэлэлцүүлэгт компанийн хамт олон бүрэн бүрэлдэхүүнээрээ оролцдог.",
        image: "/benefits/wellbeing-forum.jpg",
      },
      { title: "Эрүүл мэндийн үзлэг" },
      { title: "Спортын арга хэмжээ" },
      { title: "Ажилтны амралт" },
      { title: "Хүүхдийн баяр" },
      { title: "Шинэ жилийн үдэшлэг" },
      { title: "Тэтгэмж, урамшуулал" },
    ],
  },
  {
    key: "clubs",
    label: "Хобби клубууд",
    // Every tile here is a club's own lockup, so this wall has no placeholders
    // and no invented names: it is the roster in lib/culture, which is what HR
    // sent. The words that used to open the wall are on the first tile, and it
    // carries the Shunkhlai mark the lockups are all built around. Where a club
    // sent a photograph of itself, that picture opens with the club rather than
    // its wordmark - see <Details> in the gallery.
    wall: [
      {
        title: "Хобби клубууд",
        subtitle: "Hobby clubs",
        body: `Ажилтнуудын чөлөөт цаг, хамтын үйл ажиллагааг дэмжих зорилгоор урлаг, спорт, олон нийтийн арга хэмжээг тогтмол зохион байгуулдаг. Нийт ${clubCount} төрлийн сонирхлын клуб ажилладаг.`,
        logo: "/brand/logo-lockup.png",
      },
      ...clubs.map((club) => ({
        title: club.name,
        subtitle: club.nameEn,
        body: club.body,
        logo: club.logo,
        image: club.photo,
      })),
    ],
  },
];

/**
 * Ажиллах орчин — four walls of pictures on one held screen.
 *
 * The section is four screens tall with one pinned inside it, so the reader
 * turns the wall by scrolling and carries on out of the bottom once they have
 * been all the way through. That is the reference site's gesture without its
 * trap: it takes the wheel off the page entirely, which works when the sphere
 * is the whole site and strands the reader when it is one section of one page.
 *
 * Three of those screens turn the wall and the fourth closes it - see BEATS.
 *
 * The walls used to be three panels of prose behind the same track. They are
 * pictures now, so there is nothing left to measure or cross-fade, and what was
 * three components is the `wall` on each tab.
 */
export function CultureSection() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const { progress, isReduced } = useScrollProgress(sectionRef);
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const wall = (hash: string) =>
      TABS.findIndex((tab) => `#${tab.key}` === hash);

    // A link from elsewhere on the site names a wall by its hash, and so does
    // the address bar on a reload or a step through the history.
    const open = () => {
      const index = wall(location.hash);
      if (index >= 0) setActive(index);
    };

    /**
     * And a link followed from this page, which is a different thing entirely.
     *
     * The App Router navigates a same-page hash with `history.pushState`, and
     * by specification that fires neither `hashchange` nor `popstate`. So the
     * footer's own links - it carries three of these four walls - scrolled the
     * reader up to this section and left whichever wall happened to be up:
     * click "Хобби клубууд" while reading and you arrive at Сургалт, хөгжил.
     * Nothing was wrong with the hrefs; there was simply no event to answer.
     */
    const follow = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      const url = new URL(link.href, location.href);
      // Same document only: a mailto, a tel or another site can share this
      // path by coincidence and means nothing by it.
      if (url.origin !== location.origin) return;
      if (url.pathname !== location.pathname) return;

      const index = wall(url.hash);
      if (index >= 0) setActive(index);
    };

    open();
    window.addEventListener("hashchange", open);
    document.addEventListener("click", follow);
    return () => {
      window.removeEventListener("hashchange", open);
      document.removeEventListener("click", follow);
    };
  }, []);

  // Three beats of turning and one of gathering. Under reduced motion there
  // is no runway at all, so the wall is a grid and the figures are a block
  // under it - see below.
  const phase = progress * BEATS;
  const turn = clamp(phase / (BEATS - 1));
  // Reduced motion reports a progress of 1 and has no beats to spend it on:
  // the wall is a plain grid there and the figures are a block under it, so
  // the closing has to read as not having started rather than as over.
  const closing =
    isReduced || TABS[active].key !== CLOSES
      ? 0
      : clamp(phase - (BEATS - 1));

  // The pictures come in over the first part of the beat, the mark stands up
  // where they meet, and the figures rise behind it. `advance` on the travel
  // so it is a journey rather than a jump; `ease` on the two arrivals.
  const gather = advance(clamp(closing / GATHER));
  const mark = ease(clamp((closing - MARK.from) / MARK.span));
  const figures = ease(clamp((closing - FIGURES.from) / FIGURES.span));

  /** Lifted as it arrives, so a block enters rather than switches on. */
  const rise = (shown: number) => ({
    opacity: shown,
    transform: `translate3d(0, ${((1 - shown) * 20).toFixed(2)}px, 0)`,
  });

  return (
    <section
      id={ID}
      ref={sectionRef}
      className={isReduced ? "relative isolate" : "relative isolate h-[400svh]"}
    >
      <SectionRule />

      {/* One landing point per wall. */}
      {TABS.map((tab) => (
        <span
          key={tab.key}
          id={tab.key}
          aria-hidden
          className="absolute top-0 block h-0 scroll-mt-16"
        />
      ))}

      <div
        className={
          isReduced
            ? "relative isolate overflow-hidden py-section"
            : "sticky top-0 isolate h-svh overflow-hidden"
        }
      >
        <FeatherLattice className="opacity-[0.5]" tone="ink" />

        {/* The wall has the whole screen and the track rides over it. Stacked,
            the track took a fifth of the height off the top and the sphere had
            to be squeezed into what was left. */}
        <div
          id={`${ID}-panel-${TABS[active].key}`}
          role="tabpanel"
          aria-labelledby={`${ID}-tab-${TABS[active].key}`}
          className="absolute inset-0"
        >
          <SphereGallery
            items={TABS[active].wall}
            progress={turn}
            gather={gather}
            className="h-full"
          />
        </div>

        {/* What the pictures close into, and what comes up behind it. Both are
            held off the screen until the gathering, and the mark is the only
            thing on the page that the wall itself turns into - so it is the
            full lockup rather than the bird alone, which would read as a
            watermark rather than as the company signing the section. */}
        {!isReduced && (
          // Starts under the heading and the track rather than at the top of
          // the screen. Centred in the whole window it had no idea the two
          // were there: the column is tall enough that its top edge landed
          // hard against the rail, and the mark read as hanging off it. These
          // are the heights that block comes to - 80 + 32 + 20 + 38 on a
          // phone, 96 + 32 + 24 + 38 from `lg` - with a gap over the top.
          <div className="pointer-events-none absolute inset-x-0 top-[12rem] bottom-0 flex flex-col items-center justify-center gap-block lg:top-[14rem]">
            {/* Drawn up to size as it arrives, from where the pictures met.
                The lockup is two <Image>s with a theme class between them and
                takes no style of its own, so the arrival rides on a wrapper
                rather than widening that component for one caller. */}
            <div
              style={{
                opacity: mark,
                transform: `scale(${(0.72 + 0.28 * mark).toFixed(3)})`,
              }}
            >
              <BrandLockup className="h-16 sm:h-20" sizes="220px" />
            </div>

            {/* Takes the pointer back only once it is up. The layer above the
                sphere is `pointer-events-none` for a reason - this panel sits
                across the middle of the stage, and left clickable while it is
                invisible it would swallow the hover on every tile behind it
                and the wall would stop answering the pointer. */}
            <FiguresPanel
              inert={figures < 0.02}
              style={{
                ...rise(figures),
                pointerEvents: figures > 0.5 ? "auto" : "none",
              }}
            />
          </div>
        )}

        {/* The section's own heading, and under it the track.
 
            The four stops finish the line: the heading asks what joining
            brings, and each one names a part of the answer. The section had no
            heading at all before this - it opened on a rail, which named its
            parts without ever saying what they were parts of. No kicker over
            it: the question is the whole of what this screen has to say, and a
            label above it only pushed the rail further into the pictures.

            The top padding clears the header and nothing more. The header is
            `fixed` at `h-16`, and this screen is pinned at `top-0` underneath
            it, so anything above 64px is behind the navigation - which is
            where the heading had been sitting, cut off along its cap line.

            What is left has to hold the heading and the rail without reaching
            the pictures. The sphere is centred in the screen and its topmost
            tile lands about 190px above that centre, so on the shortest window
            this runs in there are about 200px to spend: 80 of clearance, a
            line of heading, a short gap, and the rail.

            The track stays up through the gathering. Only one of the four
            walls closes, so it is the way back to the other three — taken
            away, a reader who arrived at the end of this one would have to
            scroll the section back up to find them again. */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-20 lg:px-10 lg:pt-24">
          {/* TODO(HR): wording is a first pass on the line asked for - swap it
              for yours and nothing else here changes. */}
          <h2 className="type-section font-semibold tracking-[-0.02em] text-balance">
            Бидэнтэй нэгдсэнээр та
          </h2>

          <div className="mt-5 lg:mt-6">
            <SectionRail
              items={TABS}
              selected={active}
              onSelect={setActive}
              idPrefix={ID}
              label="Ажиллах орчны хэсгүүд"
            />
          </div>
        </div>

        {/* What the wall does, said once at the foot of it.
 
            A sphere of photographs does not look like a set of controls, and
            nothing else on the screen says the pictures answer a click. It
            goes when they do: past the gathering there is nothing left to
            open, and a standing instruction to click something that is no
            longer there is worse than no instruction at all. */}
        {!isReduced && (
          <p
            inert={gather > 0.5}
            style={{ opacity: 1 - gather }}
            className="pointer-events-none absolute inset-x-0 bottom-6 z-10 px-6 text-center type-kicker text-muted-foreground"
          >
            Зураг дээр дарж дэлгэрэнгүй мэдээлэлтэй танилцана уу
          </p>
        )}

        {/* Reduced motion has no beats to hang the figures on, so they are
            simply the last thing in the section. */}
        {isReduced && (
          <div className="mt-section">
            <FiguresPanel />
          </div>
        )}
      </div>
    </section>
  );
}
