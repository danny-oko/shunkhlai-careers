/**
 * Company facts shown across the landing and About pages.
 *
 * Wording is HR's own, from Shunkhlai_Content_Plan.docx. Anything still
 * awaiting them is marked TODO(HR) with what is outstanding.
 */

export type Stat = {
  /** Numeric part, animated by <StatCounter>. */
  value: number;
  /** Rendered after the number, e.g. "+". */
  suffix?: string;
  label: string;
  labelEn: string;
};

/**
 * The four figures HR published, in their order.
 *
 * Updated from HR's own message of 2026-09-22: 33 years, 112 stations, 8
 * depots, 1200+ employees. The content plan's earlier set - 30+ years, 21
 * provinces, 99+ stations - was a year older, and the provinces figure gave
 * way to the headcount because that is the fourth figure HR sent. 21 provinces
 * is still true and still said, in the haulage line of <RoadScene>'s chain.
 */
export const stats: Stat[] = [
  {
    value: 33,
    label: "жилийн туршлага",
    labelEn: "years of operation",
  },
  {
    value: 112,
    label: "шатахуун түгээх станц",
    labelEn: "fuel stations",
  },
  { value: 8, label: "бүсийн агуулах", labelEn: "regional depots" },
  {
    value: 1200,
    suffix: "+",
    label: "нийт ажилтан",
    labelEn: "employees",
  },
];

export type EraEntry = {
  title: string;
  body: string;
  /**
   * The record's own photograph, shown in the stage frame in place of the
   * span's. The frame is 3:4 and every photograph fills it, so each record
   * reads at the same size.
   *
   * Every record now carries one of HR's own photographs (the September
   * 2026 drops), cut to 3:4 when they were put in `public`. The ones lifted
   * off the group's history poster (doc/tuuh.pdf) were only about 300px
   * across and were all replaced; they are still in `public/history`.
   */
  image?: string;
  /** Read in place of `image`. Required alongside it. */
  imageAlt?: string;
  /**
   * The year the record happened, shown beside its heading.
   *
   * Not a new fact: every one of these is the year that entry's own paragraph
   * opens with - "1993 онд", "2010 оны 10-р сарын 5-ны өдөр" - lifted out so
   * the reader has it before reading rather than a sentence in. The span in
   * the rail is the era, which is a different thing: 2000-2010 is where this
   * record sits, 2010 is when it happened.
   */
  year: string;
};

export type Era = {
  /** The span, as the group's own history page labels it. */
  period: string;
  /**
   * The group's own photograph of the business that span opened, shown in
   * the same 3:4 frame as a record's own, centre-cropped to fill it.
   *
   * Shown for a record that carries no photograph of its own. Since every
   * record was given one, none of these is on screen; the spans keep them
   * for the records HR may put back.
   */
  image: string;
  alt: string;
  /** The records kept for that span: one or two of them. */
  entries: EraEntry[];
};

/**
 * Түүхэн замнал: six milestones, one for each year HR asked the section to
 * stop at - 1993, 1998, 2003, 2011, 2014, 2023.
 *
 * The spans below are the group's own division of its history, from
 * sg.mn/group-introduction, and the records inside them are the fuel
 * business's milestones off the group's history poster (doc/tuuh.pdf, HR's
 * file). The poster and the history page are the source of record for these
 * years, so their wording is kept and is not rewritten.
 *
 * The section used to run every record of both - the group's other
 * businesses (АПУ, NTV, Скайтел, Хайнекен, GS25, the data centre) alongside
 * the fuel milestones, twenty-one records in all. HR cut it to these six.
 * The ones dropped are in the history of this file, and their photographs
 * are still in `public/history`, so any of them can be put back by adding
 * the entry again.
 */
export const eras: Era[] = [
  {
    period: "1993-2000",
    image: "/history/shunkhlai-depot.webp",
    alt: "Шунхлайн лого бүхий нефть савны өмнө гурван ажилтан хамгаалалтын малгайтай зогсож, зураг төслийн хавтсыг хамтдаа харж байна.",
    entries: [
      {
        title: "Бизнесийн гараа",
        year: "1993",
        body: "1993 онд автомашины баталгаат засвар үйлчилгээний цомхон үйл ажиллагаагаар Шунхлай групп бизнесийн гараагаа эхэлж байсан нь тухайн үедээ Монголд байгаагүй хамгийн хэрэгцээтэй үйлчилгээний салбар, шинэхэн стандарт байсан юм.",
        image: "/history/photo-1993-price-board.webp",
        imageAlt: "“Шунхлай” үнийн самбар дээрх А-76, Аи-93, ДТ шатахууны үнийг улбар шар хувцастай ажилтан шатаар авирч сольж буй хуучин гэрэл зураг.",
      },
      {
        title: "Анхны нефть бааз",
        year: "1998",
        body: "1998 онд Шунхлай ХХК анхны шатахуун түгээх станц, анхны нефть баазаа барилаа. Энэ нь газрын тосны бүтээгдэхүүн хадгалах, хүлээн авах 5000 метр куб багтаамжтай, найман вагонцистернийг зэрэг ачиж буулгах хүчин чадалтай байв.",
        image: "/history/photo-1998-station.webp",
        imageAlt: "“Шунхлай” бичигтэй тоосгон байшин бүхий анхны шатахуун түгээх станцын саравчны дор таван ажилтан зогсож буй хуучин гэрэл зураг.",
      },
    ],
  },
  {
    period: "2000-2010",
    image: "/history/apu-plant.webp",
    alt: "АПУ-гийн үйлдвэрийн танхимд ажилтнууд хамтдаа гараа өргөн баяр хүргэж байна.",
    entries: [
      {
        title: "Өөрийн лаборатори",
        year: "2003",
        body: "Бүтээгдэхүүнд шинжилгээ хийх, чанар стандартын шаардлагыг баталгаажуулах иж бүрэн лабораторийг ашиглалтад оруулав.",
        image: "/history/photo-2003-laboratory.webp",
        imageAlt: "Шунхлайн лабораторийн ширээн дээр эгнүүлэн тавьсан шатахууны чанар шинжлэх багаж төхөөрөмжүүд.",
      },
    ],
  },
  {
    period: "2010-2020",
    image: "/history/skytel-noc.webp",
    alt: "Харилцаа холбооны сүлжээний хяналтын төвд инженер олон дэлгэцийн өмнө ажиллаж байна.",
    entries: [
      {
        title: "Аймаг бүрт салбартай",
        year: "2011",
        body: "Монгол орон даяар шатахуун түгээх станцын өргөн сүлжээг бий болгож, аймаг бүрт салбар нэгжтэй боллоо.",
        image: "/history/photo-2011-station.webp",
        imageAlt: "Цэлмэг тэнгэрийн дор цэнхэр, улбар шар өнгийн саравчтай Шунхлай шатахуун түгээх станц, түгээгүүрүүд.",
      },
      {
        title: "Байгаль орчин, аюулгүй ажиллагаа",
        year: "2014",
        body: "Байгаль орчин, хөдөлмөрийн аюулгүй байдалд чиглэсэн цогц бодлогуудыг хэрэгжүүлж, олон улсын ISO14001, OHSAS18001 стандартуудыг үйл ажиллагаандаа нэвтрүүллээ.",
        // The photograph 1993 used to show, moved here at HR's request when
        // 1993 was given the price-board picture. Hard hats in front of the
        // tanks suits a safety-and-environment record better than it suited
        // a repair workshop.
        image: "/history/shunkhlai-depot.webp",
        imageAlt: "Шунхлайн лого бүхий нефть савны өмнө гурван ажилтан хамгаалалтын малгайтай зогсож, зураг төслийн хавтсыг хамтдаа харж байна.",
      },
    ],
  },
  {
    period: "2020-Өнөөдөр",
    image: "/history/gs25-store.webp",
    alt: "GS25 дэлгүүрийн үүдэнд хоёр залуу CAFE25 кофе барин ярилцаж байна.",
    entries: [
      {
        title: "Шинэ агуулахууд",
        year: "2023",
        body: "26000 м.куб багтаамжтай “Таван толгой” агуулах, 1200 м.куб багтаамжтай “Шивээ хүрэн” агуулах тус тус ашиглалтад орлоо.",
        image: "/history/photo-2023-depot.webp",
        imageAlt: "Хамгаалалтын хувцастай хоёр ажилтан шатахууны агуулахын цистерн дээр алгаа ташиж байна, ард нь агуулахын савнууд.",
      },
    ],
  },
];

/** Content plan 2.2. */
export const vision = {
  label: "Алсын хараа",
  labelEn: "Vision",
  statement:
    "Шунхлай нь нийгмийн хариуцлагыг дээд зэргээр хангасан, ногоон хөгжлийг дэмжигч, Азийн жишигт хүрсэн үйлчилгээтэй компани болно.",
  body: "Бид зөвхөн шатахуун нийлүүлдэггүй. Аймаг бүрийн зам, тээвэр, үйлдвэрлэл, гэр бүлийн өдөр тутмын хөдөлгөөнийг тасралтгүй байлгах дэд бүтцийг бүтээж, найдвартай ажиллуулдаг.",
};

/** Content plan 2.3. The motto is the brandbook's "Уриа". */
export const mission = {
  label: "Эрхэм зорилго",
  labelEn: "Mission",
  statement: "Бид хүнийг дээдэлж, эрчимтэй хөгжлийг бүтээнэ.",
  motto: "Хүчирхэг монголын хөгжлийн хүрд",
  body: "Хөрөнгө оруулалтын хамгийн том хэсэг нь хүн. Тиймээс бид ажилтан бүрийн ур чадвар, эрүүл мэнд, карьерын өсөлтөд тогтвортой хөрөнгө оруулдаг.",
};

/** Content plan 2.4, matching brandbook p.3 — "ҮНЭТ ЗҮЙЛ". */
export const values = [
  {
    mn: "Хэрэглэгчээ дээдлэх",
    en: "Put the customer first",
    body: "Колонк дээрх 3 минут ч, жилийн гэрээ ч ижил чухал. Хэрэглэгчийн туршлагыг бүх шийдвэрийн эхэнд тавина.",
  },
  {
    mn: "Хүн бүр бүтээлч байх",
    en: "Everyone is creative",
    body: "Санаа албан тушаалаас үл хамаарна. Станцын эрхлэгчийн санал агуулахын процессыг өөрчилж чадна.",
  },
  {
    mn: "Хүрээлэн буй орчноо хайрлан хамгаалах",
    en: "Protect the environment",
    body: "Түлш зөөвөрлөх, хадгалах, түгээх бүх үе шатанд байгаль орчны эрсдэлийг тэг рүү ойртуулах нь бидний мэргэжлийн шалгуур.",
  },
  {
    mn: "Хамтын ажиллагааг эрхэмлэх",
    en: "Value working together",
    body: "Лаборатори, логистик, борлуулалт гурав нэг гинжин хэлхээ. Нэг нь удаашрах нь бүгд удаашрахтай адил.",
  },
  {
    mn: "Хариуцлагатай байх",
    en: "Be accountable",
    body: "Аюулгүй байдал, чанарын стандартыг хэн ч харахгүй байхад ижил түвшинд баримтална.",
  },
];
