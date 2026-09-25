import { clubCount, clubs } from "@/lib/culture";

import type { CultureContent } from "./schema";

/**
 * The culture wall on `/about` - "Бидэнтэй нэгдсэнээр та" and its three walls -
 * as it shipped, and what it renders whenever the `culture` row is absent,
 * unreadable or the wrong shape.
 *
 * Lifted out of `culture-section.tsx` word for word; the one change is the
 * shape: every tile carries `images` as a list, where a tile with a single
 * picture used to say `image`.
 */

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
export const CULTURE_DEFAULT: CultureContent = {
  heading: "Бидэнтэй нэгдсэнээр та",
  walls: {
    academy: {
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
      items: [
        {
          title: "Шунхлай Академи",
          body: "Мэдлэгээ хуваалцаж, хамтдаа хөгжих орон зай. 2023 онд сургалтын танхим ашиглалтад орсноор сургалт, хөгжлийн хөтөлбөрүүдийг нэг дор төвлөрүүлэн зохион байгуулах, ажилтнууд бие биенээсээ суралцаж, туршлагаа хуваалцах өөрийн гэсэн орчныг бүрдүүлсэн.",
          images: ["/academy/hall.jpg"],
        },
        {
          title: "68 дотоод сургагч багш",
          subtitle: "Мэдлэгээ хуваалцахын үнэ цэн",
          body: "Компанийн хэмжээнд 68 дотоод сургагч багш өөрсдийн мэргэжлийн мэдлэг, ажлын туршлагаа хамт олонтойгоо хуваалцан ажиллаж байна. Дотоод сургагч багш нарыг хоёр жил тутам үе шаттайгаар бэлтгэдэг бөгөөд сургалтаараа дамжуулан байгууллагын ёс соёл, практик мэдлэгийг дараагийн ажилтнуудад хүргэх үүрэг гүйцэтгэдэг.",
          images: ["/academy/trainer.jpg"],
        },
        {
          title: "edu.shunkhlai.mn",
          subtitle: "Дотоод цахим сургалтын платформ",
          body: "Ажилтан хаанаас ч суралцах боломжтой дижитал мэдлэгийн сан. Одоогийн байдлаар 192 видео хичээл байршсан бөгөөд мэргэжлийн болон техникийн сургалтаас гадна сонгон судлах агуулга, сэтгэл зүйн эрүүл мэндийг дэмжих хичээлүүд багтдаг.",
          images: ["/academy/classroom.jpg"],
        },
        {
          title: "LinkedIn Learning",
          subtitle: "20 мянга гаруй сургалт",
          body: "Олон улсын сургалтын сангийн нээлттэй хичээл. Өөрсдийн мэргэжил, ур чадварын мэдлэгийг олон улсын агуулгатай хослуулан ажилтан бүр өөрийн хэрэгцээ, сонирхол, хөгжлийн зорилгодоо нийцсэн сургалтыг сонгон суралцах боломжтой.",
          images: ["/academy/team.jpg"],
        },
        {
          title: "Хөгжил тоон үзүүлэлтээр",
          subtitle: "2026",
          body: "10,029 сургалтын хамрагдалт, 13,883 цагийн сургалт, 4,197 зохион байгуулсан сургалт, сургалтын дараах дундаж үнэлгээ 90.7 хувь. Эдгээр тоо нь компанийн хэмжээнд суралцах боломж хэр өргөн хүрээнд бий болж, ажилтнууд хэр идэвхтэй оролцож байгааг харуулдаг.",
          images: ["/academy/open-day.jpg"],
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
          images: ["/academy/ai-2026-class.jpg"],
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
          images: ["/academy/stocktake-class.jpg"],
        },
      ],
    },
    benefits: {
      label: "Хөнгөлөлт, хангамж",
      // HR's "Шунхлайд ажиллахын давуу тал" package, split back into its nine
      // headings, each carrying the photographs that were laid out beside it -
      // four for the sports, three for the grants - which the dialog runs
      // through. The two days of paid leave and the three wellbeing tiles are
      // the earlier content plan's, kept beside the heading each belongs under -
      // the two days are hidden for now, having no photograph yet.
      items: [
        {
          title: "Шунхлайд ажиллахын давуу тал",
          subtitle: "Ажилтныхаа ажил, амьдралын тэнцвэр болон сайн сайхан байдлыг цогцоор нь дэмжинэ",
          body: "Шунхлай ХХК нь ажилтнуудынхаа эрүүл мэнд, сайн сайхан байдал, гэр бүл, амралт, хөгжлийг дэмжсэн ажлын орчныг бүрдүүлэхийг зорьдог. Эдгээр боломж нь ажилтнуудыг урт хугацаанд тогтвортой ажиллаж, ажил болон хувийн амьдралынхаа тэнцвэрийг хадгалахад дэмжлэг болдог.",
          images: ["/benefits/benefits-lead.jpg"],
        },
        {
          title: "Эрүүл мэндийн дэмжлэг",
          body: "Ажилтнуудынхаа эрүүл мэндэд тогтмол анхаарч, урьдчилан сэргийлэх үзлэг, шинжилгээ болон шаардлагатай үед эмчилгээ, сувиллын дэмжлэг үзүүлдэг. Эрүүл, тогтвортой ажиллах нөхцөлийг бүрдүүлэх нь бидний хүний нөөцийн бодлогын чухал хэсэг юм.",
          images: ["/benefits/health-support.jpg"],
        },
        // Hidden until HR sends a photograph for it: without one the tile turned
        // on the wall as a blank. Add it from /admin/content once there is a photograph.
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
          images: ["/benefits/paid-leave.jpg"],
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
          images: ["/benefits/wellbeing-session.jpg"],
        },
        {
          title: "Сэтгэл зүйн эрүүл мэнд",
          body: "Сэтгэл зүйн эрүүл мэндээ хамгаалах нь ажилтны сайн сайхан байдлын үндэс. Шунхлай ХХК нь ажилтнуудынхаа сэтгэл зүйн эрүүл мэндийг дэмжих чиглэлээр тогтмол сургалт, хөгжлийн хөтөлбөрүүдийг хэрэгжүүлдэг.",
          images: ["/benefits/wellbeing-talk.jpg"],
        },
        {
          title: "Optimal Nmax хамтын ажиллагаа",
          subtitle: "Сэтгэл зүйн эрүүл мэндийг дэмжих хөтөлбөр",
          body: "Employee Wellbeing хөтөлбөрийн хүрээнд мэргэжлийн байгууллагатай хамтран ажиллаж, ажилтнуудад сэтгэл зүйн дэмжлэг үзүүлэх тогтолцоог бүрдүүлж байна.",
          images: ["/benefits/wellbeing-partnership.jpg"],
        },
        {
          title: "Хамт олны уулзалт",
          body: "Сэтгэл зүйн эрүүл мэндийг дэмжих хөтөлбөрийн уулзалт, хэлэлцүүлэгт компанийн хамт олон бүрэн бүрэлдэхүүнээрээ оролцдог.",
          images: ["/benefits/wellbeing-forum.jpg"],
        },
        {
          title: "Хүүхдийн зуслан",
          body: "Ажилтнуудынхаа гэр бүлийг дэмжих хүрээнд хүүхдүүдийг зуны амралтаа үр бүтээлтэй, аюулгүй орчинд өнгөрүүлэх боломжтой зуслан, хөгжлийн хөтөлбөрт хамрагдахад нь дэмжлэг үзүүлдэг.",
          images: ["/benefits/kids-camp.jpg"],
        },
        {
          title: "Гадаад болон дотоод аялал",
          body: "Ажилтнуудынхаа хамтын ажиллагаа, идэвх оролцоо, ажлын урам зоригийг дэмжих зорилгоор дотоод болон гадаад аялал, хамтын хөтөлбөрүүдийг зохион байгуулдаг. Эдгээр аялал нь шинэ орчинд хамт олноороо цагийг үр бүтээлтэй өнгөрүүлэх, харилцаа холбоогоо бэхжүүлэх, шинэ туршлага хуримтлуулах боломжийг бүрдүүлдэг.",
          images: ["/benefits/travel.jpg"],
        },
      ],
    },
    clubs: {
      label: "Хобби клубууд",
      // Every tile here is a club's own lockup, so this wall has no placeholders
      // and no invented names: it is the roster in lib/culture, which is what HR
      // sent. The words that used to open the wall are on the first tile, and it
      // carries the Shunkhlai mark the lockups are all built around. Where a club
      // sent photographs of itself, those open with the club rather than its
      // wordmark, all of them - see <Details> in the gallery.
      items: [
        {
          title: "Хобби клубууд",
          body: `Ажилтнуудын чөлөөт цаг, хамтын үйл ажиллагааг дэмжих зорилгоор урлаг, спорт, олон нийтийн арга хэмжээг тогтмол зохион байгуулдаг. Нийт ${clubCount} төрлийн сонирхлын клуб ажилладаг.`,
          images: [],
          logo: "/brand/logo-lockup.png",
        },
        ...clubs.map((club) => ({
          title: club.name,
          body: club.body,
          logo: club.logo,
          images: club.photos ?? [],
        })),
      ],
    },
  },
};
