/**
 * Field limits for the newsroom.
 *
 * Shared by the Worker, which enforces them, and the site, which shows them to
 * the editor as counters. One file so the counter can never promise a length
 * the API then refuses.
 *
 * Dependency-free on purpose: the Worker imports this by relative path from
 * outside its own package, so it must not pull anything from node_modules.
 */
export const LIMITS = {
  title: 140,
  lede: 320,
  author: 80,
  coverAlt: 160,
  categoryName: 40,
  categoryDescription: 200,
  /** Characters of visible text in a body — not bytes of JSON. */
  bodyText: 40_000,
  /** Nodes in a body document. Bounds the work of sanitising and rendering. */
  bodyNodes: 6_000,
  /** Serialised size of a body document. D1 rows cap out at 2MB. */
  bodyBytes: 512_000,
  /** One photograph off a phone, give or take. */
  imageBytes: 8 * 1024 * 1024,
} as const;

/** Raster formats only. SVG is a document that can carry script. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** The same list, as Cloudinary's `allowed_formats` wants it. */
export const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif"] as const;
