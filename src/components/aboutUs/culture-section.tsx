"use client";

import * as React from "react";

import { FeatherLattice } from "@/components/brand/feather-lattice";
import { SectionRule } from "@/components/brand/section-rule";
import { SectionRail } from "@/components/aboutUs/section-rail";
import { SphereGallery } from "@/components/aboutUs/sphere-gallery";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { academyVoices, clubs } from "@/lib/culture";

const ID = "culture";

/**
 * The walls.
 *
 * `body` is what the dialog shows when a picture is opened. Where HR have
 * written the words already they are theirs, carried over from the panels of
 * prose these walls replaced; the rest are marked below and show a standing
 * note instead of invented copy.
 *
 * TODO(HR): the pictures on the first two walls are placeholders —
 * `public/brand/mock-*.jpg` — and every entry without a `body` is waiting for
 * one. The clubs wall is HR's own artwork throughout.
 *
 * The keys are the hashes these used to be their own sections under, so every
 * link already written against them — the site footer — still arrives at the
 * right place and opens the right wall. The vision and the values left for
 * <StatementBands> above and took their hashes with them.
 */
const TABS = [
  {
    key: "academy",
    label: "Сургалт, хөгжил",
    // The five Academy posters are the real pictures on this wall: each is a
    // person, their job and something they said to anyone starting out, so the
    // tile opens onto a portrait and a quote rather than a caption. They are
    // the artwork HR already made — `academyVoices` in lib/culture — and the
    // only entries here that are not waiting for a photograph.
    wall: [
      ...academyVoices.map((voice) => ({
        title: voice.name,
        role: voice.role,
        body: voice.quote,
        image: voice.src,
      })),
      {
        title: "Shunkhlai Academy",
        body: "Компанийн үнэт зүйлс алсын хараа руу чиглэсэн мэдлэг, ур чадварыг хөгжүүлэх замаар хүний нөөцийн тасралтгүй залгамж халааг бэлтгэн ажилтанг чадваржуулах бодлого баримтлан ажилладаг.",
      },
      {
        title: "Дотоод сургалт",
        body: "Компанийн өөрийн сургагч багш нар мэдлэг, ур чадварын хөрөнгө оруулалтыг ажилтнууддаа хийдэг.",
      },
      {
        title: "Гадны сургагч багштай хичээл",
        body: "Салбартаа хүлээн зөвшөөрөгдсөн сургагч багш, сургалтын байгууллагууд.",
      },
      { title: "Шинэ ажилтны хөтөлбөр" },
      { title: "ШТС-ын ур чадварын сургалт" },
      { title: "Аюулгүй ажиллагааны дадлага" },
      { title: "Удирдлагын хөтөлбөр" },
    ],
  },
  {
    key: "benefits",
    label: "Хөнгөлөлт, хангамж",
    wall: [
      {
        title: "Гэр бүлийн өдөр",
        body: "Жилд 1 өдрийн цалинтай чөлөө. (Family day)",
      },
      {
        title: "Эрүүл мэндийн өдөр",
        body: "Жилд 2 өдрийн цалинтай чөлөө. (Health day)",
      },
      {
        title: "Сэтгэл зүйн дэмжлэг",
        body: "Шунхлай ХХК нь ажилтнуудынхаа сайн сайхан байдал, сэтгэл зүйн эрүүл мэндийг дэмжих чиглэлээр тогтмол сургалт, хөгжлийн хөтөлбөрүүдийг хэрэгжүүлдэг.",
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
    // carries the Shunkhlai mark the thirteen lockups are all built around.
    wall: [
      {
        title: "Хобби клубууд",
        subtitle: "Hobby clubs",
        body: "Ажилтнуудын чөлөөт цаг, хамтын үйл ажиллагааг дэмжих зорилгоор урлаг, спорт, олон нийтийн арга хэмжээг тогтмол зохион байгуулдаг. Нийт 14 төрлийн сонирхлын клуб ажилладаг.",
        logo: "/brand/logo-lockup.png",
      },
      ...clubs.map((club) => ({
        title: club.name,
        subtitle: club.nameEn,
        logo: club.logo,
      })),
    ],
  },
];

/**
 * Ажиллах орчин — three walls of pictures on one held screen.
 *
 * The section is three screens tall with one pinned inside it, so the reader
 * turns the wall by scrolling and carries on out of the bottom once they have
 * been all the way through. That is the reference site's gesture without its
 * trap: it takes the wheel off the page entirely, which works when the sphere
 * is the whole site and strands the reader when it is one section of one page.
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
    // A link from elsewhere on the site names a wall by its old hash.
    const open = () => {
      const index = TABS.findIndex((tab) => `#${tab.key}` === location.hash);
      if (index >= 0) setActive(index);
    };

    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  return (
    <section
      id={ID}
      ref={sectionRef}
      className={isReduced ? "relative isolate" : "relative isolate h-[300svh]"}
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
            ? "relative isolate overflow-hidden py-20"
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
            progress={progress}
            className="h-full"
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-24 lg:px-10">
          <SectionRail
            items={TABS}
            selected={active}
            onSelect={setActive}
            idPrefix={ID}
            label="Ажиллах орчны хэсгүүд"
          />
        </div>
      </div>
    </section>
  );
}
