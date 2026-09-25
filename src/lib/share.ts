/**
 * What a shared link unfurls to in Telegram, Messenger, Facebook and the like.
 *
 * The image is the hero photo on Cloudinary, asked for as a 1200×630 JPEG:
 * that is the card size every messenger crops to, and some crawlers still
 * skip WebP. Absolute, so it does not depend on `metadataBase`.
 */
const CLOUDINARY = "https://res.cloudinary.com/doxmbmqjm/image/upload";
const CARD = "f_jpg,q_auto,w_1200,h_630,c_fill,g_auto";
// eslint-disable-next-line no-secrets/no-secrets -- a Cloudinary public id, not a secret
const HERO = "v1790302115/careers-hero-join_kc9ulz.webp";

export const SHARE_IMAGE = {
  url: `${CLOUDINARY}/${CARD}/${HERO}`,
  width: 1200,
  height: 630,
  alt: "Шунхлай ХХК - Бид хүнийг дээдэлж, эрчимтэй хөгжлийг бүтээнэ",
};

export const SHARE_MOTTO = "Бид хүнийг дээдэлж, эрчимтэй хөгжлийг бүтээнэ.";
