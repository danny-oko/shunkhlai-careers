/**
 * Company facts shown across the landing and About pages.
 *
 * Everything here comes from the careers brief (Shunkhlai_Careers_Brief_Plan).
 * Copy marked TODO(HR) is a placeholder the HR team still has to sign off on —
 * the brief puts final wording and imagery on their side.
 */

export type Stat = {
  /** Numeric part, animated by <StatCounter>. */
  value: number;
  /** Rendered after the number, e.g. "+". */
  suffix?: string;
  label: string;
  labelEn: string;
};

export const stats: Stat[] = [
  { value: 30, suffix: "+", label: "жилийн туршлага", labelEn: "years of operation" },
  { value: 21, label: "аймагт салбартай", labelEn: "provinces covered" },
  { value: 99, suffix: "+", label: "шатахуун түгээх станц", labelEn: "fuel stations" },
  { value: 8, label: "агуулах", labelEn: "storage depots" },
  { value: 1, label: "итгэмжлэгдсэн лаборатори", labelEn: "accredited laboratory" },
];

export type Milestone = {
  /** Shown as the rail marker. A decade when the exact year is unconfirmed. */
  period: string;
  title: string;
  body: string;
};

/** TODO(HR): confirm the exact years behind the decade-level entries. */
export const milestones: Milestone[] = [
  {
    period: "1993",
    title: "Эхлэл — авто засвар үйлчилгээ",
    body: "Шунхлай ХХК авто засвар, үйлчилгээний жижиг багаар үйл ажиллагаагаа эхлүүлж, машин техникийн ард ажилладаг хүмүүсийн соёлыг тэр цагаас өвлөн авсан.",
  },
  {
    period: "1990-ээд",
    title: "Газрын тосны салбар руу",
    body: "Засварын үйлчилгээнээс газрын тосны бүтээгдэхүүний импорт, худалдаа руу шилжиж, өнөөгийн үндсэн бизнесийн суурийг тавьсан.",
  },
  {
    period: "2000-аад",
    title: "ШТС-ын сүлжээ",
    body: "Улаанбаатар хотод шатахуун түгээх станцын сүлжээгээ өргөжүүлж, жижиглэн худалдааны стандарт, үйлчилгээний соёлоо тогтоосон.",
  },
  {
    period: "2010-аад",
    title: "Улс даяар",
    body: "Орон нутгийн салбар, агуулахын сүлжээ, өөрийн тээврийн флотыг байгуулж, нийслэлээс гадуур найдвартай хангамжийг бий болгосон.",
  },
  {
    period: "Өнөөдөр",
    title: "Хөдөлмөр — хөгжлийн хөдөлгүүр",
    body: "21 аймагт 99 гаруй ШТС, 8 агуулах, тээврийн флот, улсын итгэмжлэгдсэн чанарын шинжилгээний лабораторитойгоор Монгол улсын хөдөлгүүр бүрийг тэжээж байна.",
  },
];

export const vision = {
  label: "Алсын хараа",
  labelEn: "Vision",
  /** TODO(HR): replace with the approved vision statement. */
  statement: "Монгол улсын эрчим хүчний хангамжийн хамгийн найдвартай түнш байх.",
  body: "Бид зөвхөн шатахуун нийлүүлдэггүй. Аймаг бүрийн зам, тээвэр, үйлдвэрлэл, гэр бүлийн өдөр тутмын хөдөлгөөнийг тасралтгүй байлгах дэд бүтцийг бүтээж, найдвартай ажиллуулдаг.",
};

export const mission = {
  label: "Эрхэм зорилго",
  labelEn: "Mission",
  statement: "Бид хүнийг дээдэлж, эрчимтэй хөгжлийг бүтээнэ.",
  body: "Хөрөнгө оруулалтын хамгийн том хэсэг нь хүн. Тиймээс бид ажилтан бүрийн ур чадвар, эрүүл мэнд, карьерын өсөлтөд тогтвортой хөрөнгө оруулдаг.",
};

/** Brandbook p.3 — "ҮНЭТ ЗҮЙЛ". */
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

/** The 21 aimags, plus the capital. Used by the opening loader's ticker. */
export const provinces = [
  "Улаанбаатар",
  "Архангай",
  "Баян-Өлгий",
  "Баянхонгор",
  "Булган",
  "Говь-Алтай",
  "Говьсүмбэр",
  "Дархан-Уул",
  "Дорноговь",
  "Дорнод",
  "Дундговь",
  "Завхан",
  "Орхон",
  "Өвөрхангай",
  "Өмнөговь",
  "Сүхбаатар",
  "Сэлэнгэ",
  "Төв",
  "Увс",
  "Ховд",
  "Хөвсгөл",
  "Хэнтий",
];

export type CareerField = {
  name: string;
  nameEn: string;
  blurb: string;
};

/**
 * The brief's central message: Shunkhlai is not only fuel-station staff.
 * These are the professional tracks the company actually hires into.
 */
export const careerFields: CareerField[] = [
  { name: "Хүний нөөц", nameEn: "People & HR", blurb: "Сонгон шалгаруулалт, сургалт, ажилтны туршлага" },
  { name: "Санхүү", nameEn: "Finance", blurb: "Санхүүгийн шинжилгээ, төсөв, тайлагнал" },
  { name: "Чанарын хяналт", nameEn: "Quality control", blurb: "Улсын итгэмжлэгдсэн химийн лаборатори" },
  { name: "Логистик, тээвэр", nameEn: "Logistics", blurb: "Флотын удирдлага, маршрут, агуулахын үйл ажиллагаа" },
  { name: "Борлуулалт", nameEn: "Sales", blurb: "Корпорацийн харилцагч, гэрээ, хангамж" },
  { name: "Маркетинг", nameEn: "Marketing", blurb: "Брэнд, кампанит ажил, хэрэглэгчийн судалгаа" },
  { name: "Мэдээллийн технологи", nameEn: "Technology", blurb: "Дотоод систем, дата, дижитал бүтээгдэхүүн" },
  { name: "Захиргаа", nameEn: "Administration", blurb: "Хууль, эрсдэл, аж ахуй, дотоод үйл ажиллагаа" },
];
