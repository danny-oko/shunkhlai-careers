import { blocksToDoc } from "@/lib/news/legacy";
import { type BlockNode, type RichDoc, sanitizeDoc } from "@/lib/news/shared/rich-text";
import type { NewsArticle, NewsBlock } from "@/lib/news/types";

import images from "../../../scripts/news/images.json";
import source from "../../../scripts/news/articles.source.json";

/**
 * The newsroom's content, as the owner supplied it.
 *
 * Two files under `scripts/news/`, both data rather than code:
 *
 * - `articles.source.json` — the nine articles: stable ids
 *   (`art_shunkhlai_festival_2026`), slugs, copy, and bodies still in the old
 *   `NewsBlock[]` shape;
 * - `images.json` — which Cloudinary photograph belongs where, matched to the
 *   owner's docx by perceptual hash. It is JSON on purpose: the file names are
 *   long runs of digits that a secret scanner reads as keys, and a map nobody
 *   should edit by hand is better kept out of the code anyway.
 *
 * Nothing in the running app imports this. It is what `scripts/news/sync.ts`
 * writes into D1, kept in `src/` so the builders below can be unit-tested with
 * the rest of the newsroom. The placeholder copy that used to live here is
 * gone; the seven rows it once produced are set to draft by the sync, never
 * deleted.
 */

type SourceArticle = Omit<NewsArticle, "body"> & { body: NewsBlock[] };

type ImageEntry = { path: string; title: string; alt: string };
type ImageMap = {
  base: string;
  articles: Record<string, { cover: string | null; gallery: ImageEntry[] }>;
};

/** One picture to set into a body: already an absolute https URL. */
export type GalleryImage = { src: string; alt: string; title: string | null };

/**
 * Editorial dates pinned regardless of what the source file says. The ISO
 * article is dated 30 June 2026 by instruction; pinning it here means a later
 * re-export of the source cannot quietly move it.
 */
const PUBLISHED_AT_OVERRIDES: Readonly<Record<string, string>> = {
  "art_iso_certification_2026": "2026-06-30",
};

/**
 * Sets the gallery into a body: one picture after each paragraph, in order,
 * and whatever is left over after the last block.
 *
 * Only top-level paragraphs count as slots — a paragraph inside a quote or a
 * list item is part of that block, and a picture in the middle of a quotation
 * would split it. Headings, lists and quotes are passed over, so a picture
 * always follows prose. The result goes back through `sanitizeDoc`, the same
 * gate every saved body passes, so an image whose source is not https simply
 * does not appear.
 *
 * Pure: the same inputs give the same document, so a second `--force` run
 * writes exactly what the first one did.
 */
export function withGallery(doc: RichDoc, gallery: readonly GalleryImage[]): RichDoc {
  const queue = [...gallery];
  const content: BlockNode[] = [];

  const imageNode = (image: GalleryImage): BlockNode => ({
    type: "image",
    attrs: { src: image.src, alt: image.alt, title: image.title, width: null, height: null },
  });

  for (const block of doc.content) {
    content.push(block);
    const next = block.type === "paragraph" ? queue.shift() : undefined;
    if (next) content.push(imageNode(next));
  }
  for (const image of queue) content.push(imageNode(image));

  return sanitizeDoc({ type: "doc", content });
}

/** A path from `images.json`, made absolute. Null stays null. */
function hosted(base: string, path: string | null | undefined): string | null {
  return path ? `${base}${path}` : null;
}

/**
 * The nine articles, ready to store.
 *
 * - the body is converted from blocks and the gallery set into it;
 * - the cover is the Cloudinary URL from the map, never the `seed:` key the
 *   source file still carries — an article the map has no cover for (the
 *   mental-health piece, pending a photograph from the owner) gets none rather
 *   than a stand-in;
 * - `coverAlt` is the source's own;
 * - one lead only. The front page has a single lead slot and the desk's star
 *   is a radio; the source marks two stories featured, so the first in file
 *   order (the festival) keeps it and the rest are cleared.
 *
 * `createdAt` / `updatedAt` are the source's. The sync stamps `updated_at`
 * with the time it writes.
 */
export function seedArticles(
  articles: readonly SourceArticle[] = (source as { articles: SourceArticle[] }).articles,
  map: ImageMap = images as ImageMap,
): NewsArticle[] {
  let leadTaken = false;

  return articles.map((article) => {
    const entry = map.articles[article.id] ?? { cover: null, gallery: [] };
    const gallery = entry.gallery.map((image) => ({
      src: `${map.base}${image.path}`,
      alt: image.alt,
      title: image.title || null,
    }));

    const featured = article.featured && !leadTaken;
    if (featured) leadTaken = true;

    return {
      ...article,
      publishedAt: PUBLISHED_AT_OVERRIDES[article.id] ?? article.publishedAt,
      coverKey: hosted(map.base, entry.cover),
      featured,
      body: withGallery(blocksToDoc(article.body), gallery),
    };
  });
}

/**
 * The rows the newsroom started with — placeholder copy written before the
 * owner's content existed. They stay in D1 (nothing here deletes), and the
 * sync keeps them off the site by setting them to draft.
 */
export const PLACEHOLDER_IDS = [
  "art_2af8b2ed10",
  "art_320e890490",
  "art_aa4715c59a",
  "art_e519b6ff68",
  "art_198c1d071f",
  "art_fc1959b1ff",
  "art_e3264be05c",
] as const;
