/**
 * The three #ХөдөлмөрХөгжлийнХөдөлгүүр campaign key visuals.
 *
 * Each poster already carries the campaign lockup, so they are shown in a
 * cinematic band of their own rather than as a wallpaper behind our type —
 * nothing is cropped through the headline and nothing is said twice.
 */
export type HeroSlide = {
  src: string;
  /** The word that changes in the campaign lockup on this poster. */
  word: string;
  caption: string;
  captionEn: string;
  alt: string;
};

export const heroSlides: HeroSlide[] = [
  {
    src: "/brand/kv-amjilt.jpg",
    word: "амжилтын",
    caption: "Тээвэр, логистик",
    captionEn: "Transport & logistics",
    alt: "Шунхлайн ажилтан тал хээр дундуур явж буй автоцистерн машины ард",
  },
  {
    src: "/brand/kv-amidral.jpg",
    word: "амьдралын",
    caption: "Ажилтан, гэр бүл",
    captionEn: "People & family",
    alt: "Шунхлайн ажилтан ногоон талбай дээрх айлын гэрийг гартаа барьж байна",
  },
  {
    src: "/brand/kv-hogjil.jpg",
    word: "хөгжлийн",
    caption: "Дэд бүтэц, хангамж",
    captionEn: "Infrastructure & supply",
    alt: "Шунхлайн ажилтан нисэх буудлын дэргэд онгоцыг алган дээрээ тэнцвэрлүүлж байна",
  },
];
