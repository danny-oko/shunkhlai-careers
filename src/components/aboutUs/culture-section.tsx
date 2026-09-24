"use client";

import * as React from "react";

import { FeatherLattice } from "@/components/brand/feather-lattice";
import { SectionRule } from "@/components/brand/section-rule";
import { SectionRail } from "@/components/aboutUs/section-rail";
import { SphereGallery } from "@/components/aboutUs/sphere-gallery";
import { FiguresPanel } from "@/components/aboutUs/academy-principle";
import { BrandLockup } from "@/components/brand/brand-logo";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import type { AboutStatsContent } from "@/lib/content/schema";
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
 * benefits wall their "Шунхлайд ажиллахын давуу тал" package plus the two
 * days of paid leave from the earlier content plan, and the clubs wall their
 * roster. Where a tile has no `body` it shows a standing note rather than
 * invented copy, and six of the courses below are waiting on one: the photo
 * plan they came from is a plan for photographs and says nothing about what
 * any course teaches, so there is nothing here to write them from.
 *
 * The pictures are HR's own too. The Academy wall carries the photographs
 * they sent of the training hall, and then the eighteen from their course
 * photo plan; the benefits wall the seventeen laid out through that package;
 * and the clubs wall each club's lockup - with the club's own photograph
 * behind it where one was delivered.
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
    // Two things at once, and in that order: what the Academy is - the hall,
    // the 68 people who teach in it, the two platforms that carry it to
    // everyone who is not in the room, and the year's totals - and then the
    // courses themselves, as HR's own September photo plan lists them.
    //
    // That plan is where the runs come from. It sets each course out as a
    // cover, a picture of it happening and a detail, so a course opens as the
    // strip those three make rather than as one framed shot, and the tile
    // shows the cover. Where it asked for a photograph nobody has taken yet
    // the course simply carries the ones it has.
    wall: [
      {
        title: "Шунхлай Академи",
        body: "Мэдлэгээ хуваалцаж, хамтдаа хөгжих орон зай. 2023 онд сургалтын танхим ашиглалтад орсноор сургалт, хөгжлийн хөтөлбөрүүдийг нэг дор төвлөрүүлэн зохион байгуулах, ажилтнууд бие биенээсээ суралцаж, туршлагаа хуваалцах өөрийн гэсэн орчныг бүрдүүлсэн.",
        image: "/academy/hall.jpg",
      },
      {
        title: "68 дотоод сургагч багш",
        subtitle: "Мэдлэгээ хуваалцахын үнэ цэн",
        body: "Компанийн хэмжээнд 68 дотоод сургагч багш өөрсдийн мэргэжлийн мэдлэг, ажлын туршлагаа хамт олонтойгоо хуваалцан ажиллаж байна. Дотоод сургагч багш нарыг хоёр жил тутам үе шаттайгаар бэлтгэдэг бөгөөд сургалтаараа дамжуулан байгууллагын ёс соёл, практик мэдлэгийг дараагийн ажилтнуудад хүргэх үүрэг гүйцэтгэдэг.",
        image: "/academy/trainer.jpg",
      },
      {
        title: "edu.shunkhlai.mn",
        subtitle: "Дотоод цахим сургалтын платформ",
        body: "Ажилтан хаанаас ч суралцах боломжтой дижитал мэдлэгийн сан. Одоогийн байдлаар 192 видео хичээл байршсан бөгөөд мэргэжлийн болон техникийн сургалтаас гадна сонгон судлах агуулга, сэтгэл зүйн эрүүл мэндийг дэмжих хичээлүүд багтдаг.",
        image: "/academy/classroom.jpg",
      },
      {
        title: "LinkedIn Learning",
        subtitle: "20 мянга гаруй сургалт",
        body: "Олон улсын сургалтын сангийн нээлттэй хичээл. Өөрсдийн мэргэжил, ур чадварын мэдлэгийг олон улсын агуулгатай хослуулан ажилтан бүр өөрийн хэрэгцээ, сонирхол, хөгжлийн зорилгодоо нийцсэн сургалтыг сонгон суралцах боломжтой.",
        image: "/academy/team.jpg",
      },
      {
        title: "Хөгжил тоон үзүүлэлтээр",
        subtitle: "2026",
        body: "10,029 сургалтын хамрагдалт, 13,883 цагийн сургалт, 4,197 зохион байгуулсан сургалт, сургалтын дараах дундаж үнэлгээ 90.7 хувь. Эдгээр тоо нь компанийн хэмжээнд суралцах боломж хэр өргөн хүрээнд бий болж, ажилтнууд хэр идэвхтэй оролцож байгааг харуулдаг.",
        image: "/academy/open-day.jpg",
      },

      // The nine courses, in the order the photo plan sets them out.
      {
        title: "Manager's Development Program 2026",
        subtitle: "Дунд шатны менежерүүдийн хөтөлбөр",
        // The year is off the sentence rather than off the tile: the pictures
        // are the 2026 class taking its certificates, and the write-up this
        // came from was describing the 2025 one doing the same thing.
        body: "Удирдлага, манлайллын хөгжлийн хөтөлбөрүүдийн нэг. Төгсөгчид хөтөлбөрөө амжилттай дүүргэж, гэрчилгээгээ гардан авч буй агшин.",
        images: [
          "/academy/mdp-2026-graduates.jpg",
          "/academy/mdp-2026-class.jpg",
        ],
      },
      {
        title: "Дотоод сургагч багш бэлтгэх хөтөлбөр 2026",
        images: [
          "/academy/trainers-2026-certificates.jpg",
          "/academy/trainers-2026-session.jpg",
          "/academy/trainers-2026-class.jpg",
        ],
      },
      {
        title: "Шинэ ажилтны чиглүүлэх сургалт 2026",
        body: "Ажилтан компанид анх орсон үеэс эхлэн ажлын байрандаа мэргэших, ур чадвараа тасралтгүй хөгжүүлэх, цаашлаад менежер, манлайлагч болон өсөх замыг үе шаттайгаар дэмждэг.",
        images: [
          "/academy/induction-2026-group.jpg",
          "/academy/induction-2026-visit.jpg",
        ],
      },
      {
        title: "AI сургалт 2026",
        subtitle: "Ирээдүйн ур чадвар",
        body: "Сургалтын агуулгыг технологийн өөрчлөлт, ирээдүйд шаардлагатай ур чадвартай нягт уялдуулж AI & Innovation, Lead with AI, Excel & Power BI зэрэг хөтөлбөрүүдийг хэрэгжүүлж байна. Энэ нь ажилтнуудаа ирээдүйн технологийн өөрчлөлтөд бэлтгэхэд чиглэдэг.",
        image: "/academy/ai-2026-class.jpg",
      },
      {
        title: "Эрхлэгч бэлтгэх хөтөлбөр",
        images: [
          "/academy/supervisor-program-group.jpg",
          "/academy/supervisor-program-class.jpg",
        ],
      },
      {
        title: "Жолооч нарын сургалт",
        images: [
          "/academy/drivers-certificates.jpg",
          "/academy/drivers-session.jpg",
        ],
      },
      {
        title: "Сэтгэл зүйн эрүүл мэндээ хамгаалах сургалт",
        images: [
          "/academy/mindcare-forum.jpg",
          "/academy/mindcare-workshop.jpg",
          "/academy/mindcare-gathering.jpg",
        ],
      },
      {
        title: "Power BI",
        images: [
          "/academy/power-bi-class.jpg",
          "/academy/power-bi-session.jpg",
        ],
      },
      {
        title: "Тооллогын сургалт",
        image: "/academy/stocktake-class.jpg",
      },
    ],
  },
  {
    key: "benefits",
    label: "Хөнгөлөлт, хангамж",
    // HR's "Шунхлайд ажиллахын давуу тал" package, split back into its nine
    // headings, each carrying the photographs that were laid out beside it -
    // four for the sports, three for the grants - which the dialog runs
    // through. The two days of paid leave and the three wellbeing tiles are
    // the earlier content plan's, kept beside the heading each belongs under -
    // the two days are hidden for now, having no photograph yet.
    wall: [
      {
        title: "Шунхлайд ажиллахын давуу тал",
        subtitle: "Ажилтныхаа ажил, амьдралын тэнцвэр болон сайн сайхан байдлыг цогцоор нь дэмжинэ",
        body: "Шунхлай ХХК нь ажилтнуудынхаа эрүүл мэнд, сайн сайхан байдал, гэр бүл, амралт, хөгжлийг дэмжсэн ажлын орчныг бүрдүүлэхийг зорьдог. Эдгээр боломж нь ажилтнуудыг урт хугацаанд тогтвортой ажиллаж, ажил болон хувийн амьдралынхаа тэнцвэрийг хадгалахад дэмжлэг болдог.",
        image: "/benefits/benefits-lead.jpg",
      },
      {
        title: "Эрүүл мэндийн дэмжлэг",
        body: "Ажилтнуудынхаа эрүүл мэндэд тогтмол анхаарч, урьдчилан сэргийлэх үзлэг, шинжилгээ болон шаардлагатай үед эмчилгээ, сувиллын дэмжлэг үзүүлдэг. Эрүүл, тогтвортой ажиллах нөхцөлийг бүрдүүлэх нь бидний хүний нөөцийн бодлогын чухал хэсэг юм.",
        image: "/benefits/health-support.jpg",
      },
      // Hidden until HR sends a photograph for it: without one the tile turned
      // on the wall as a blank. Add `image:` and uncomment to bring it back.
      // {
      //   title: "Эрүүл мэндийн өдөр",
      //   body: "Жилд 2 өдрийн цалинтай чөлөө.",
      // },
      {
        title: "Спорт, идэвхтэй амьдрал",
        body: "Ажилтнуудыг эрүүл, идэвхтэй амьдралын хэв маягтай байхад нь дэмжиж, фитнес, спорт заал болон төрөл бүрийн спортын арга хэмжээнд хамрагдах боломжийг бүрдүүлдэг.",
        images: [
          "/benefits/sport-cup.jpg",
          "/benefits/sport-cup-team.jpg",
          "/benefits/sport-basketball.jpg",
          "/benefits/sport-hall.jpg",
        ],
      },
      {
        title: "Амралт, сувилал",
        body: "Ажилтнуудынхаа эрүүл мэндийг хамгаалах, эрч хүчээ нөхөхөд нь дэмжлэг үзүүлэх зорилгоор рашаан, сувиллын хөтөлбөрт хамруулдаг. Сувиллын төлбөрийг компани бүрэн хариуцаж, ажилтныг цалинтай чөлөөгөөр амрах боломжийг бүрдүүлдэг.",
        images: [
          "/benefits/sanatorium.jpg",
          "/benefits/resort-outing.jpg",
        ],
      },
      {
        title: "Ажилтанд зориулсан тэтгэмжүүд",
        body: "Ажилтны амьдралын чухал үе шат болон шаардлагатай нөхцөлд дэмжлэг үзүүлэх төрөл бүрийн тэтгэмж, тусламжийн бодлого хэрэгжүүлдэг. Үүнд гэр бүл, хүүхэд, эрүүл мэнд болон бусад амьдралын хэрэгцээтэй холбоотой дэмжлэгүүд багтана.",
        images: [
          "/benefits/grant-housing-certificate.jpg",
          "/benefits/grant-living.jpg",
          "/benefits/grant-scholarship.jpg",
        ],
      },
      {
        title: "Цалинтай чөлөө",
        body: "Ажил, хувийн амьдралын тэнцвэрийг дэмжих зорилгоор тодорхой нөхцөлд цалинтай чөлөө авах боломжийг бүрдүүлдэг. Ингэснээр ажилтнууд гэр бүл, хувийн амьдралдаа шаардлагатай цаг гаргах боломжтой.",
        image: "/benefits/paid-leave.jpg",
      },
      // Hidden until HR sends a photograph for it - see "Эрүүл мэндийн өдөр".
      // {
      //   title: "Гэр бүлийн өдөр",
      //   body: "Жилд 1 өдрийн цалинтай чөлөө.",
      // },
      {
        title: "Компанийн арга хэмжээнүүд",
        body: "Хамт олны уур амьсгал, багийн ажиллагааг дэмжих зорилгоор баяр, спорт, аялал, дотоод арга хэмжээ болон ажилтнуудыг идэвхжүүлэх төрөл бүрийн хөтөлбөрийг тогтмол зохион байгуулдаг.",
        images: [
          "/benefits/gala-team.jpg",
          "/benefits/kids-day.jpg",
          "/benefits/festival.jpg",
        ],
      },
      {
        title: "Сэтгэл зүйн эрүүл мэндийг дэмжих хөтөлбөр",
        body: "Ажилтнуудын сэтгэл зүйн байдалд анхаарч, стрессээ зөв удирдах, ажлын ачааллаа тэнцвэржүүлэх, шаардлагатай үед мэргэжлийн зөвлөгөө авах боломжийг дэмжсэн хөтөлбөр хэрэгжүүлдэг.",
        image: "/benefits/wellbeing-session.jpg",
      },
      {
        title: "Сэтгэл зүйн эрүүл мэнд",
        body: "Сэтгэл зүйн эрүүл мэндээ хамгаалах нь ажилтны сайн сайхан байдлын үндэс. Шунхлай ХХК нь ажилтнуудынхаа сэтгэл зүйн эрүүл мэндийг дэмжих чиглэлээр тогтмол сургалт, хөгжлийн хөтөлбөрүүдийг хэрэгжүүлдэг.",
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
      {
        title: "Хүүхдийн зуслан",
        body: "Ажилтнуудынхаа гэр бүлийг дэмжих хүрээнд хүүхдүүдийг зуны амралтаа үр бүтээлтэй, аюулгүй орчинд өнгөрүүлэх боломжтой зуслан, хөгжлийн хөтөлбөрт хамрагдахад нь дэмжлэг үзүүлдэг.",
        image: "/benefits/kids-camp.jpg",
      },
      {
        title: "Гадаад болон дотоод аялал",
        body: "Ажилтнуудынхаа хамтын ажиллагаа, идэвх оролцоо, ажлын урам зоригийг дэмжих зорилгоор дотоод болон гадаад аялал, хамтын хөтөлбөрүүдийг зохион байгуулдаг. Эдгээр аялал нь шинэ орчинд хамт олноороо цагийг үр бүтээлтэй өнгөрүүлэх, харилцаа холбоогоо бэхжүүлэх, шинэ туршлага хуримтлуулах боломжийг бүрдүүлдэг.",
        image: "/benefits/travel.jpg",
      },
    ],
  },
  {
    key: "clubs",
    label: "Хобби клубууд",
    // Every tile here is a club's own lockup, so this wall has no placeholders
    // and no invented names: it is the roster in lib/culture, which is what HR
    // sent. The words that used to open the wall are on the first tile, and it
    // carries the Shunkhlai mark the lockups are all built around. Where a club
    // sent photographs of itself, those open with the club rather than its
    // wordmark, all of them - see <Details> in the gallery.
    wall: [
      {
        title: "Хобби клубууд",
        body: `Ажилтнуудын чөлөөт цаг, хамтын үйл ажиллагааг дэмжих зорилгоор урлаг, спорт, олон нийтийн арга хэмжээг тогтмол зохион байгуулдаг. Нийт ${clubCount} төрлийн сонирхлын клуб ажилладаг.`,
        logo: "/brand/logo-lockup.png",
      },
      ...clubs.map((club) => ({
        title: club.name,
        body: club.body,
        logo: club.logo,
        images: club.photos,
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
 *
 * `stats` is passed straight through to <FiguresPanel>: this section and
 * everything under it is a client component, so the `about_stats` row is read
 * by the page and handed down rather than queried here.
 */
export function CultureSection({ stats }: { stats: AboutStatsContent }) {
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
              stats={stats}
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
            <FiguresPanel stats={stats} />
          </div>
        )}
      </div>
    </section>
  );
}
