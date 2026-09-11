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
  { value: 30, suffix: "+", label: "жилийн туршлага", labelEn: "years of operation" },
  { value: 21, label: "аймагт салбартай", labelEn: "provinces covered" },
  { value: 99, suffix: "+", label: "шатахуун түгээх станц", labelEn: "fuel stations" },
  { value: 8, label: "бүсийн агуулах", labelEn: "regional depots" },
];

export type Milestone = {
  /** Shown as the rail marker. A decade when the exact year is unconfirmed. */
  period: string;
  title: string;
  body: string;
};

/** Content plan 2.1 — HR's own history text, broken into the rail's stops. */
export const milestones: Milestone[] = [
  {
    period: "1993",
    title: "Зах зээлийн эхэн үед",
    body: "Монгол Улс зах зээлийн эдийн засагт шилжиж, салбар бүрт хувийн хэвшил бий болж байх үед үүсгэн байгуулагдсан компаниудын нэг нь Шунхлай ХХК юм. Авто засварын үйлчилгээгээр үйл ажиллагаагаа эхлүүлсэн.",
  },
  {
    period: "Удалгүй",
    title: "Газрын тосны салбарт",
    body: "Газрын тосны салбарт орж, хэрэглэгчдэд илүү боломж, шударга өрсөлдөөнийг бий болгосон.",
  },
  {
    period: "Өнөөдөр",
    title: "Импортоос борлуулалт хүртэл",
    body: "Улаанбаатар болон 21 аймагт 100 гаруй шатахуун түгээх станц, 8 бүсийн агуулах, өөрийн авто тээврийн бааз, улсын итгэмжлэгдсэн лабораторитойгоор газрын тосны бүтээгдэхүүний импорт, хадгалалт, тээвэрлэлт, борлуулалтын чиглэлээр ажиллаж байна.",
  },
  {
    period: "Стандарт",
    title: "Олон улсын гэрчилгээ",
    body: "ISO 9001:2015 (Чанар), ISO 14001:2015 (Байгаль орчин), ISO 45001:2018 (Хөдөлмөрийн эрүүл мэнд, аюулгүй байдал) стандартуудыг үйл ажиллагаандаа нэвтрүүлсэн.",
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
