/**
 * The three campaign key visuals.
 *
 * Each poster already carries the campaign lockup, so they are shown in a
 * cinematic band of their own rather than as a wallpaper behind our type —
 * nothing is cropped through the headline and nothing is said twice.
 */
export type HeroSlide = {
  src: string;
  caption: string;
  alt: string;
};

export const heroSlides: HeroSlide[] = [
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
];
