import type {
  AboutStatsContent,
  ContentKey,
  ContentValue,
  FooterContent,
  HeroContent,
} from "./schema";
import { CULTURE_DEFAULT } from "./culture-default";

/**
 * What each section said before it was editable — and what it says again the
 * moment the database cannot answer.
 *
 * This file is the "typed fallback" half of the feature, and it is the reason
 * an empty `site_content` table is not a bug: every public read is
 * `stored ?? DEFAULT`, so a fresh install, a row nobody has written yet, a row
 * that fails its schema and a Postgres that is simply down all render the
 * site exactly as it shipped. Blank marketing copy is worse than stale
 * marketing copy — an empty hero reads as a broken deployment.
 *
 * The values below are transcribed from the components they were lifted out
 * of, not rewritten: `hero-stage.tsx` / `hero-overlay.tsx` for the hero,
 * `site-footer.tsx` for the address and contact column, and `academyFigures`
 * in `src/lib/culture.ts` for the About tiles. Editing one of these changes
 * what an *unwritten* section says; it does not change a section an admin has
 * already saved.
 *
 * They are typed as the schemas' own output, so a field renamed in
 * `./schema.ts` is a type error here rather than a fallback that silently
 * stops matching.
 */

/** The three campaign key visuals, and the type in front of them. */
export const HERO_DEFAULT: HeroContent = {
  heading: "Хүчирхэг монголын хөгжлийн хүрд",
  slides: [
    {
      src: "/brand/kv-amjilt.jpg",
      caption: "Тээвэр, логистик",
      alt: "Шунхлайн ажилтан тал хээр дундуур явж буй автоцистерн машины ард",
    },
    {
      src: "/brand/kv-amidral.jpg",
      caption: "Ажилтан, гэр бүл",
      alt: "Шунхлайн ажилтан ногоон талбай дээрх айлын гэрийг гартаа барьж байна",
    },
    {
      src: "/brand/kv-hogjil.jpg",
      caption: "Дэд бүтэц, хангамж",
      alt: "Шунхлайн ажилтан нисэх буудлын дэргэд онгоцыг алган дээрээ тэнцвэрлүүлж байна",
    },
  ],
  // The open-role count is printed in front of this label at render time.
  primaryCta: { label: "нээлттэй ажлын байр", href: "/careers" },
  secondaryCta: { label: "Бидний тухай", href: "/about" },
};

/**
 * The registered office and the contact column.
 *
 * `addressUrl` is the company's own Google Maps listing by `cid`, not a
 * search for the address beside it — see the long note in `site-footer.tsx`
 * for why searching the printed address lands two kilometres away.
 */
export const FOOTER_DEFAULT: FooterContent = {
  address: "Капитал Хаус, Чингисийн өргөн чөлөө 48/1, Улаанбаатар-36",
  addressUrl: "https://www.google.com/maps?cid=82938535878474455",
  contacts: [
    { label: "Утас", value: "9669-6229", href: "tel:+97696696229" },
    { label: "Facebook", value: "Shunkhlai HR", href: "https://www.facebook.com/ShunkhlaiHR" },
    {
      label: "Instagram",
      value: "Shunkhlai_jobs",
      href: "https://www.instagram.com/shunkhlai_jobs/",
    },
  ],
};

/** The Academy's own totals for the year, from HR's September write-up. */
export const ABOUT_STATS_DEFAULT: AboutStatsContent = {
  heading: "Хөгжил тоон үзүүлэлтээр · 2026",
  items: [
    { value: "10,029", label: "сургалтын хамрагдалт" },
    { value: "13,883", label: "цагийн сургалт" },
    { value: "4,197", label: "зохион байгуулсан сургалт" },
    { value: "90.7%", label: "сургалтын дараах үнэлгээ" },
  ],
};

/**
 * Annotated as the mapped type rather than inferred with `satisfies`: the
 * readers are generic in the key (`getContent<K>`), and only this annotation
 * lets `CONTENT_DEFAULTS[key]` be `ContentValue<K>` rather than a union of all
 * three sections.
 */
export const CONTENT_DEFAULTS: { [K in ContentKey]: ContentValue<K> } = {
  hero: HERO_DEFAULT,
  footer: FOOTER_DEFAULT,
  "about_stats": ABOUT_STATS_DEFAULT,
  culture: CULTURE_DEFAULT,
};

/**
 * What the admin desk calls each section, and where a saved one shows up.
 *
 * The paths are what `revalidatePath` is given after a successful save. The
 * public pages read the database on every dynamic render, so this is not a
 * server-side data cache being cleared so much as two other caches: the
 * browser's client router cache (so an admin who saves and then opens the
 * page in the same tab is not shown the prefetched old one), and, for `/`,
 * the five-minute ISR window it keeps for the recruitment API.
 *
 * The footer is in the root layout, so it is every page at once — hence
 * `layout` rather than a list nobody would remember to extend.
 */
export const CONTENT_SECTIONS = {
  hero: {
    title: "Нүүр хуудасны толгой",
    blurb: "Нүүр хуудсыг нээх зураг, гарчиг, товчнууд.",
    paths: [{ path: "/", type: "page" }],
  },
  footer: {
    title: "Хөл хэсэг",
    blurb: "Бүх хуудасны хөлд гарах хаяг, холбоо барих мэдээлэл.",
    paths: [{ path: "/", type: "layout" }],
  },
  "about_stats": {
    title: "Бидний тухай - тоон үзүүлэлт",
    blurb: "/about хуудсыг хаах сургалтын тоон үзүүлэлтүүд.",
    paths: [{ path: "/about", type: "page" }],
  },
  culture: {
    title: "Бидний тухай - Бидэнтэй нэгдсэнээр та",
    blurb: "Сургалт, хөнгөлөлт, клубуудын зурагт хана: гарчиг, хэсгийн нэр, зураг бүрийн бичвэр.",
    paths: [{ path: "/about", type: "page" }],
  },
} as const satisfies {
  [K in ContentKey]: {
    title: string;
    blurb: string;
    paths: ReadonlyArray<{ path: string; type: "page" | "layout" }>;
  };
};
