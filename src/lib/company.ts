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
 * Content plan 1.2 — the four figures HR published, in their order.
 *
 * Unreferenced at the moment: the landing page's statistics section was taken
 * down to be rebuilt. Kept because this is HR's published copy, not scaffolding.
 */
export const stats: Stat[] = [
  {
    value: 30,
    suffix: "+",
    label: "жилийн туршлага",
    labelEn: "years of operation",
  },
  { value: 21, label: "аймагт салбартай", labelEn: "provinces covered" },
  {
    value: 99,
    suffix: "+",
    label: "шатахуун түгээх станц",
    labelEn: "fuel stations",
  },
  { value: 8, label: "бүсийн агуулах", labelEn: "regional depots" },
];

export type EraEntry = {
  title: string;
  body: string;
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
   * The group's own photograph of the business that span opened, already
   * cropped to the frame it hangs in. The section changes photographs a tile
   * at a time and the tiles are cut from the frame, so a photograph that had
   * to be cover-cropped in the browser would not line up with them.
   */
  image: string;
  alt: string;
  /** The three records the group tells that span through. */
  entries: EraEntry[];
};

/**
 * Түүхэн замнал, verbatim from the group's own history page at
 * sg.mn/group-introduction. That page is the source of record for the
 * group's dates, so the wording here is theirs and is not rewritten - only
 * the two entries that arrived as separate paragraphs are joined into one.
 *
 * This replaces the four-stop summary the section used to carry, which was
 * the fuel business only. The group's own account runs wider than that, and
 * the four spans below are how it divides itself.
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
      },
      {
        title: "Газрын тосны бизнесийн эхлэл",
        year: "1996",
        body: "1996 оноос газрын тосны бүтээгдэхүүний бөөний худалдааны бизнесийг эрхлэх болж, ширүүн өрсөлдөөн бүхий жижиглэнгийн зах зээлд нэвтрэн өдгөө бид энэхүү салбартаа Монгол улсын тэргүүлэх зэрэглэлийн үндэсний худалдааны компаниудын нэгт зүй ёсоор тооцогдож байна.",
      },
      {
        title: "Анхны нефть бааз",
        year: "1998",
        body: "1998 онд Шунхлай ХХК анхны шатахуун түгээх станц, анхны нефть баазаа барилаа. Энэ нь газрын тосны бүтээгдэхүүн хадгалах, хүлээн авах 5000 метр куб багтаамжтай, найман вагонцистернийг зэрэг ачиж буулгах хүчин чадалтай байв.",
      },
    ],
  },
  {
    period: "2000-2010",
    image: "/history/apu-plant.webp",
    alt: "АПУ-гийн үйлдвэрийн танхимд ажилтнууд хамтдаа гараа өргөн баяр хүргэж байна.",
    entries: [
      {
        title: "АПУ ХК-н хувьчлал",
        year: "2001",
        body: "2001 онд олон нийтэд нээлттэй дуудлага худалдаанд оролцон, уналтад ороод байсан төрийн өмчийн “АПУ” компанийн төрийн эзэмшлийн хувийг худалдан авав.",
      },
      {
        title: "Өөдрөг өнгө, өөр өнцөг",
        year: "2006",
        body: "Монголын тэргүүлэгч телевизүүдийн нэг NTV телевиз нь 2006 оноос үйл ажиллагаагаа явуулж эхлэв. Тус телевиз нь улс төр, нийгэм, эдийн засгийн цаг үеийн мэдээ мэдээллээс гадна түүх, соёл урлаг, боловсрол, цэнгээнт, шоу нэвтрүүлгүүд бэлтгэн хүргэдэг.",
      },
      {
        title: "Жи Эс Би Капитал ББСБ",
        year: "2010",
        body: "Жи Эс Би Капитал ББСБ-г Шунхлай группийн хөрөнгө оруулалтаар 2010 оны 10-р сарын 5-ны өдөр үүсгэн байгуулав. Тус компани нь Улаанбаатар хотод 10, хөдөө орон нутагт 1 салбар нээж нийт 11 салбар нэгжээр дамжуулан тогтвортой, хүртээмжтэй зээлийн үйл ажиллагааг хүргэснээр өдгөө 30,000 гаруй харилцагчтай болсон байна.",
      },
    ],
  },
  {
    period: "2010-2020",
    image: "/history/skytel-noc.webp",
    alt: "Харилцаа холбооны сүлжээний хяналтын төвд инженер олон дэлгэцийн өмнө ажиллаж байна.",
    entries: [
      {
        title: "Бизнесийн тэлэлт",
        year: "2011",
        body: "2011 онд БНСУ-ын “Hyundai Motors Corporation”, “Kia Motors Corporation”-н авто машин, механизмын албан ёсны онцгой эрхийг авав. Үүрэн холбооны “Скайтел” компанид хувь эзэмшлээ нэмэгдүүлэн, голлох хувьцаа эзэмшигчдийн нэг болов.",
      },
      {
        title: "Тээвэр, ложистикийн салбар",
        year: "2012",
        body: "Олон улсын тээвэр зуучлалын “Сантранс Ложистикс” ХХК нь 2012 онд үүсгэн байгуулагдсан бөгөөд гаалийн зуучлал болоод олон улсын стандартад нийцсэн хамгийн хямд, түргэн шуурхай, аюулгүй, даатгагдсан ачаа тээврийн үйлчилгээг дэлхийн хаанаас ч зохион байгуулан мэргэжлийн өндөр түвшинд амжилттай гүйцэтгэж байна.",
      },
      {
        title: "Дэлхийн тоглогчтой хамтрав",
        year: "2017",
        body: "2017 онд Шунхлай групп нь Монголын хөрөнгийн зах зээлийн хамгийн том хэлцлийг хийж, Нидерландын Хайнекен компанитай Монгол дахь архи, шар айргийн бизнесээ нэгтгэлээ.",
      },
    ],
  },
  {
    period: "2020-Өнөөдөр",
    image: "/history/gs25-store.webp",
    alt: "GS25 дэлгүүрийн үүдэнд хоёр залуу CAFE25 кофе барин ярилцаж байна.",
    entries: [
      {
        title: "Ая тухтай дэлгүүр",
        year: "2020",
        body: "2020 онд БНСУ-ын GS25 сүлжээ дэлгүүрийн мастер франчайз эрхийг эзэмшигч Дижитал Концепт компанийг Монгол талаас Шунхлай Холдинг, АПУ ХК болон БНСУ талаас Жи Эс Ритэйл компани хамтран байгуулав.",
      },
      {
        title: "Технологийн салбарт хөрөнгө оруулав",
        year: "2022",
        body: "2022 онд Монголын дата төвийн талбарт шинэчлэлт авчрах зорилго бүхий Эс системс ХХК-г байгуулж, хэмжээгээрээ хамгийн том, технологи шийдлээрээ хамгийн сүүлийн үеийнхэд тооцогдох дата төвийг бүтээн байгуулав.",
      },
      {
        title: "Зеро технологи компани",
        year: "2023",
        body: "2023 оноос программ хангамж, мэдээллийн технологийн чиглэлээр үйлчилгээ үзүүлэх Зеро технологи ХХК-ны үйл ажиллагааг эхлүүлэв.",
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
  motto: "Хөгжлийн төлөөх хөдөлгүүр бүрийг тэжээнэ.",
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
