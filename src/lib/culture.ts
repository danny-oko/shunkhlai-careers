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
    highlight:
      "2018 оноос хойш 250,000 км зам туулж, 2,158,000 литр ачаа тээвэрлэсэн.",
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
    highlight:
      "2016 оноос хойш 500 гаруй ачааны машиныг засаж, дээд амжилт тогтоосон.",
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

/*
 * Урмын үгс - the five Shunkhlai Academy posters - stood here: a person, their
 * job and the one thing each would tell somebody starting out, transcribed off
 * the artwork so the words could be read at a readable size.
 *
 * Removed at the client's request along with the artwork itself. Four of the
 * five files went with it; `public/brand/academy-solongo.jpg` stayed, because
 * it is the cover of a seeded news article and is not this section's to take.
 * The quotes and the wall they were shown on are in the history of this file
 * if they are ever wanted back.
 */

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
  /** The club's own lockup: the Shunkhlai mark beside its wordmark. */
  logo: string;
  /**
   * Photographs of the club at something it actually did, where HR sent any.
   *
   * The lockup stays on the tile - it is what names the club on the wall - and
   * the pictures open with it, because a wordmark says which club it is and a
   * picture says what belonging to it looks like. Where a club sent several,
   * all of them are here and the dialog runs through them.
   */
  photos?: string[];
  /** What the club does. See the TODO below: these are drafts, not HR's copy. */
  body?: string;
};

/**
 * Content plan 2.8. The clubs as HR's own lockups and photo folders name them.
 *
 * Each logo is a wide transparent lockup - the eagle beside the club's
 * wordmark - so these are drawn whole on a light plate rather than cropped
 * like the photographs elsewhere on the wall. The lockup carries the club's
 * English wordmark as artwork; `name` is what is written under it, and it is
 * the only name said in words, for a reader who never sees the picture.
 *
 * Three names follow the photo folders rather than the older list: HR's own
 * folders say "Алхалтын клуб Hiking", "Гоо зүйн клуб VOGUE" and "Шагай
 * харвааны клуб", which are the Mongolian names the club members use.
 *
 * TODO(HR): every `body` here is a draft written from the photographs and the
 * club's own name, not copy HR has published - the content plan gives the
 * count and nothing else. Replace them with the clubs' own words; they are
 * marked in one place so the whole set can be swapped in one pass.
 *
 * There was an Innovation club here too, standing on the company lockup for
 * want of its own. It was taken out at the client's request.
 */
export const clubs: Club[] = [
  {
    name: "Шагай харвааны клуб",
    logo: "/clubs/shagai.png",
    photos: ["/clubs/photos/shagai.jpg", "/clubs/photos/shagai-2.jpg"],
    body: "Үндэсний шагай харваагаар баг бүрдүүлэн тогтмол бэлтгэл хийж, улсын болон салбарын тэмцээнд Шунхлай ХХК-ийг төлөөлөн оролцдог.",
  },
  {
    name: "Спорт клуб",
    logo: "/clubs/sport.png",
    body: "Сагсан бөмбөг, волейбол, ширээний теннис зэрэг олоон төрлөөр тогтмол бэлтгэл хийж, компанийн дотоод болон салбар хоорондын тэмцээнд оролцдог.",
  },
  {
    name: "И-спорт клуб",
    logo: "/clubs/e-sport.png",
    photos: ["/clubs/photos/e-sport.jpg"],
    body: "Онлайн тоглоомын төрлүүдээр дотоод тэмцээн зохион байгуулж, багаар ажиллах, стратеги төлөвлөх чадварыг чөлөөт цагаараа хөгжүүлдэг.",
  },
  {
    name: "Алхалтын клуб",
    logo: "/clubs/hiking.png",
    photos: [
      "/clubs/photos/hiking.jpg",
      "/clubs/photos/hiking-2.jpg",
      "/clubs/photos/hiking-3.jpg",
    ],
    body: "Улирал бүр хот орчмын болон орон нутгийн уулын маршрутаар явган аялал зохион байгуулдаг. Ажилтан гэр бүлийнхээ хамт оролцох боломжтой.",
  },
  {
    name: "Бүжгийн клуб",
    logo: "/clubs/dance.png",
    body: "Бүжгийн бэлтгэлээ хийж, компанийн баяр ёслол, арга хэмжээнд тоглолтоо үзүүлдэг.",
  },
  {
    name: "Шинжлэх ухааны клуб",
    logo: "/clubs/science.png",
    photos: [
      "/clubs/photos/science-2.jpg",
      "/clubs/photos/science.jpg",
      "/clubs/photos/science-3.jpg",
    ],
    body: "Шинэ технологи, салбарын судалгаа, сонирхолтой нээлтүүдийг хамтдаа судалж, хамт олондоо танилцуулдаг.",
  },
  {
    name: "Англи хэлний клуб",
    logo: "/clubs/english.png",
    photos: ["/clubs/photos/english.jpg", "/clubs/photos/english-2.jpg"],
    body: "Долоо хоног бүрийн уулзалтаар ярианы дадлага хийж, ажлын байранд хэрэгтэй Business English-ийн мэдлэгээ хөгжүүлдэг.",
  },
  {
    name: "Гоо зүйн клуб",
    logo: "/clubs/vogue.png",
    photos: [
      "/clubs/photos/vogue.jpg",
      "/clubs/photos/vogue-2.jpg",
      "/clubs/photos/vogue-3.jpg",
    ],
    body: "Гоо зүй, хувцаслалт, өөрийгөө илэрхийлэх сэдвээр уулзалт, фото төсөл зохион байгуулдаг.",
  },
];

/**
 * Read off the roster rather than written down beside it.
 *
 * The content plan's own figure was 14 against thirteen lockups, and the gap
 * sat in this file as a TODO for as long as the number was typed by hand. The
 * roster names whatever is listed above, and whatever is added next counts
 * itself.
 */
export const clubCount = clubs.length;

/*
 * `academyFigures` - Shunkhlai Academy's figures for the year - used to stand
 * here. They are editable now, so they live where every editable section's
 * fallback lives: `ABOUT_STATS_DEFAULT` in `src/lib/content/defaults.ts`,
 * read through `getContent("about_stats")`. The values are unchanged, and are
 * still strings for the same reason - these are read as shapes, not summed;
 * "10,029" and "90.7%" carry a separator and a unit a number would have to be
 * given back.
 */

export type DevelopmentShare = {
  /** The share itself, and the width the band is drawn at. */
  share: number;
  title: string;
  body: string;
};

/**
 * Хөгжлийн 70/20/10 зарчим, from the Academy write-up.
 *
 * `share` is both the number printed and the width the band takes, so the
 * picture cannot drift from the figure beside it: the 70 is seven times the
 * 10 on screen because it is seven times the 10 in the policy.
 */
export const developmentShares: DevelopmentShare[] = [
  {
    share: 70,
    title: "Ажлын байран дээрх туршлага",
    body: "Бодит ажил, шинэ үүрэг даалгавар, төсөл хөтөлбөр, асуудал шийдвэрлэх, шинэ санаа турших замаар мэдлэгээ бодит ур чадвар болгон хөгжүүлнэ.",
  },
  {
    share: 20,
    title: "Бусдаас суралцах",
    body: "Хамтран ажиллах, туршлага хуваалцах, удирдлага болон хамт олноосоо санал хүсэлт авах, coaching, mentoring, дотоод сургагч багшаас суралцах замаар хөгжинө.",
  },
  {
    share: 10,
    title: "Системтэй сургалт",
    body: "Танхимын болон цахим сургалт, мэргэжлийн хөтөлбөр, семинар, сертификаттай сургалтаар шинэ мэдлэг, арга барил эзэмшинэ.",
  },
];

/** The line the write-up closes the principle with. */
export const developmentSum =
  "70% Туршлага + 20% Хүмүүс + 10% Сургалт = Тасралтгүй хөгжил";
