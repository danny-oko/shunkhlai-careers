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
  /** 3:4 poster or 16:9 banner — the shape the artwork was delivered in. */
  shape: "portrait" | "wide";
  /**
   * `object-position` for the one asset that is not already the 4:5 the
   * gallery frames everything at, so the crop keeps the person rather than
   * splitting the difference with whatever is beside them.
   */
  focus?: string;
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
    headline: "Монгол улсыг олон тойрсон хүн",
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
    // At 4:5 only 42% of this 1920-wide frame survives. 30% is the furthest
    // right the window can sit and still clear the headline printed into the
    // artwork — past it a sliver of the type shows at the edge and reads as a
    // botched crop — while still holding her whole.
    focus: "30% center",
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

/**
 * Shunkhlai Academy — ажилтнуудын зөвлөгөө.
 *
 * Read by <AcademyVoices> on the About page. The transcribed quotes are what
 * the artwork alone cannot give back: they carry the posters into the alt text
 * and into the dialog, where the words can be read at a readable size.
 */
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

/**
 * Content plan 2.6. HR has published these two so far.
 *
 * TODO(HR): the rest of the package is still to come — add entries here as
 * they arrive rather than describing anything that has not been confirmed.
 */
export const benefits: Benefit[] = [
  {
    title: "Гэр бүлийн өдөр",
    titleEn: "Family day",
    body: "Жилд 1 өдрийн цалинтай чөлөө.",
  },
  {
    title: "Эрүүл мэндийн өдөр",
    titleEn: "Health day",
    body: "Жилд 2 өдрийн цалинтай чөлөө.",
  },
];

export type Club = {
  name: string;
  /** The wordmark on the lockup, for the caption under the Mongolian name. */
  nameEn: string;
  /** The club's own lockup: the Shunkhlai mark beside its wordmark. */
  logo: string;
};

/**
 * Content plan 2.8. The clubs as HR's own lockups name them.
 *
 * Each logo is a wide transparent lockup - the eagle beside the club's
 * wordmark - so these are drawn whole on a light plate rather than cropped
 * like the photographs elsewhere on the wall. The wordmark already says the
 * club's name, and `name` repeats it in Mongolian for the caption and for a
 * reader who never sees the picture.
 *
 * TODO(HR): the count below is 14 and these are the 13 lockups delivered.
 * The fourteenth is still to come.
 */
export const clubs: Club[] = [
  { name: "Шагайн клуб", nameEn: "Shagai club", logo: "/clubs/shagai.png" },
  { name: "Спорт клуб", nameEn: "Sport club", logo: "/clubs/sport.png" },
  { name: "И-спорт клуб", nameEn: "E-sport club", logo: "/clubs/e-sport.png" },
  { name: "Дартс клуб", nameEn: "Darts club", logo: "/clubs/darts.png" },
  { name: "Хайкинг клуб", nameEn: "Hiking club", logo: "/clubs/hiking.png" },
  { name: "Бүжгийн клуб", nameEn: "Dance club", logo: "/clubs/dance.png" },
  { name: "Хөгжмийн клуб", nameEn: "Music club", logo: "/clubs/music.png" },
  { name: "Подкаст клуб", nameEn: "Podcast club", logo: "/clubs/podcast.png" },
  {
    name: "Шинжлэх ухааны клуб",
    nameEn: "Science club",
    logo: "/clubs/science.png",
  },
  {
    name: "Англи хэлний клуб",
    nameEn: "English club",
    logo: "/clubs/english.png",
  },
  { name: "Бизнес клуб", nameEn: "Business club", logo: "/clubs/business.png" },
  { name: "Vogue клуб", nameEn: "Vogue", logo: "/clubs/vogue.png" },
  { name: "Be Happy клуб", nameEn: "Be Happy", logo: "/clubs/be-happy.png" },
];

/** HR's figure, which is still one ahead of the lockups in `clubs`. */
export const clubCount = 14;
