/**
 * Employee-facing culture content: real campaign posters supplied by the
 * client, plus the benefit and club blocks the careers brief asks for.
 *
 * The story and academy posters carry their headline and copy baked into the
 * artwork, so they are rendered whole — the fields here drive alt text,
 * captions and ordering only.
 */

export type Story = {
  src: string;
  /** 3:4 poster or 16:9 banner — decides how the card is laid out. */
  shape: "portrait" | "wide";
  name: string;
  role: string;
  headline: string;
  /** One-line summary of the achievement in the poster. */
  highlight: string;
  alt: string;
};

/** "Life at Shunkhlai" — the #ХөдөлмөрХөгжлийнХөдөлгүүр story series. */
export const stories: Story[] = [
  {
    src: "/brand/story-driver.jpg",
    shape: "portrait",
    name: "Г. Батжаргал",
    role: "Цэнэглэх машины жолооч",
    headline: "Монгол улсыг 36 удаа бүтэн тойрсон хүн",
    highlight: "2018 оноос хойш 250,000 км зам туулж, 2,158,000 литр ачаа тээвэрлэсэн.",
    alt: "Цэнэглэх машины жолооч Г. Батжаргал автоцистерн машины дэргэд зогсож байна",
  },
  {
    src: "/brand/story-engineer-director.jpg",
    shape: "portrait",
    name: "Ш. Гэрэлт-Од",
    role: "Техник, технологи хариуцсан захирал",
    headline: "Хамгийн олон малгай элээсэн хүн",
    highlight: "2003 онд ШТС-ын эрхлэгчээр орж, 16 жилд 5 удаа тушаал дэвшсэн.",
    alt: "Техник, технологи хариуцсан захирал Ш. Гэрэлт-Од ажлын өрөөндөө",
  },
  {
    src: "/brand/story-auto-engineer.jpg",
    shape: "portrait",
    name: "Х. Батчулуун",
    role: "Автын инженер",
    headline: "Шидэт гартай хүн",
    highlight: "2016 оноос хойш 500 гаруй ачааны машиныг засаж, дээд амжилт тогтоосон.",
    alt: "Автын инженер Х. Батчулуун засварын нүхэнд ачааны машины доор зогсож байна",
  },
  {
    src: "/brand/story-station-operator.jpg",
    shape: "wide",
    name: "Л. Баярмаа",
    role: "ШТС-16-ийн нефть хангамжийн оператор",
    headline: "Дээд амжилт тогтоосон эмэгтэй",
    highlight: "2005 оноос хойш нийт 4,048,538 литр шатахуун борлуулсан.",
    alt: "Нефть хангамжийн оператор Л. Баярмаа Шунхлай ШТС-ын колонкын дэргэд",
  },
];

export type AcademyVoice = {
  src: string;
  name: string;
  role: string;
  /** The pull quote printed on the poster, repeated for screen readers. */
  quote: string;
};

/** Shunkhlai Academy — ажилтнуудын зөвлөгөө. */
export const academyVoices: AcademyVoice[] = [
  {
    src: "/brand/academy-myagmarsuren.jpg",
    name: "С. Мягмарсүрэн",
    role: "Борлуулалтын менежер",
    quote:
      "Анх ажилд орж байхад алдаа гаргах тохиолдол их бий. Гэхдээ алдчихлаа гээд шантрах бус түүнээсээ суралцах хэрэгтэй гэдгийг битгий мартаарай.",
  },
  {
    src: "/brand/academy-sanchir-od.jpg",
    name: "Э. Санчир-Од",
    role: "Техник ашиглалтын ахлах инженер",
    quote: "Ажлыг багаас нь хийгээд, суурийг нь мэдэж авах нь их чухал.",
  },
  {
    src: "/brand/academy-javzan.jpg",
    name: "О. Жавзан",
    role: "Шуурхай зохицуулалтын ахлах менежер",
    quote:
      "Өөрийгөө чадахгүй гээд хойш суухаас илүү аль болох оролдоод үзэх хэрэгтэй. Таны хийж буй зүйл бусдын амьдралд том өөрчлөлт авчирч чадна.",
  },
  {
    src: "/brand/academy-solongo.jpg",
    name: "Б. Солонго",
    role: "ШТС-ын эрхлэгч",
    quote:
      "Мэдэхгүй, чадахгүй зүйлээ бусдаас асуухаас бүү нэрэлхээрэй. Хүн бүрд мэдэхгүй чадахгүй зүйл байдаг шүү дээ.",
  },
  {
    src: "/brand/academy-shijirbaatar.jpg",
    name: "Г. Шижирбаатар",
    role: "Хуулийн зөвлөх",
    quote:
      "Өөрийгөө бусадтай бүү харьцуулаарай. Өөрийнхөө өнгөрсөнөөс илүү амжилттай явж байвал тэр л жинхэнэ ялалт.",
  },
];

export type Benefit = {
  title: string;
  titleEn: string;
  body: string;
};

/** TODO(HR): confirm the exact package before launch. */
export const benefits: Benefit[] = [
  {
    title: "Эрүүл мэндийн хамгаалалт",
    titleEn: "Health cover",
    body: "Ажилтны эрүүл мэндийн урьдчилан сэргийлэх үзлэг, нэмэлт даатгалын дэмжлэг.",
  },
  {
    title: "Сэтгэл зүйн дэмжлэг",
    titleEn: "Mental health support",
    body: "Мэргэжлийн сэтгэл зүйчтэй нууцлалтай уулзах боломж, стресс менежментийн хөтөлбөр.",
  },
  {
    title: "Ажилтны хөнгөлөлт",
    titleEn: "Employee discount",
    body: "Шунхлай сүлжээний шатахуун, үйлчилгээнд ажилтанд зориулсан хөнгөлөлт.",
  },
  {
    title: "Тээвэр, хоол",
    titleEn: "Transport & meals",
    body: "Ээлжийн ажилтнуудад тээвэр, хоолны зохицуулалт, орон нутгийн салбарт байрны дэмжлэг.",
  },
  {
    title: "Гэр бүлийн арга хэмжээ",
    titleEn: "Family events",
    body: "Ажилтны хүүхдүүдэд зориулсан жилийн арга хэмжээ, баярын урамшуулал.",
  },
  {
    title: "Тогтвор суурьшлын урамшуулал",
    titleEn: "Long-service reward",
    body: "Байгууллагад ажилласан жилээр нэмэгддэг амралт, урамшууллын систем.",
  },
];

export type Club = {
  name: string;
  nameEn: string;
  note: string;
};

/** TODO(HR): confirm the active club list and add photos when available. */
export const clubs: Club[] = [
  { name: "Волейбол", nameEn: "Volleyball", note: "Долоо хоног бүрийн дасгалжуулалт, салбар хоорондын тэмцээн" },
  { name: "Гүйлт", nameEn: "Running", note: "Улирлын марафонд багаараа бүртгүүлдэг" },
  { name: "Ширээний теннис", nameEn: "Table tennis", note: "Оффисын лигтэй, улирал бүр аварга тодруулдаг" },
  { name: "Уул уулзалт", nameEn: "Hiking", note: "Улирал бүрийн явган аялал, гэр бүлээрээ оролцоно" },
  { name: "Ном унших", nameEn: "Book club", note: "Сар бүрийн нэг ном, нэг хэлэлцүүлэг" },
  { name: "Гэрэл зураг", nameEn: "Photography", note: "Ажлын байрны түүхийг ажилтнууд өөрсдөө буулгадаг" },
];
