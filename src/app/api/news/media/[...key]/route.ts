import { isUrlCoverKey } from "@/lib/news/types";
import { getMedia } from "@/server/news/store";

/**
 * Serves a story's cover image.
 *
 * A catch-all rather than a single `[key]` segment, deliberately. Seeded
 * covers are addressed as `seed:brand/mock-03.jpg`, and a slash inside one
 * dynamic segment depends on whether the server treats `%2F` as an escaped
 * character or as a separator — proxies disagree, and the answer is not ours
 * to rely on. Joining the segments back together is correct under either
 * reading.
 *
 * Containment is enforced in the store, which is the only thing that turns a
 * key into a filesystem read; the `..` check here is a second, cheaper no.
 *
 * Read per request: uploaded bytes live in D1, which production and localhost
 * share, so a build-time answer would miss every cover uploaded since. The
 * long `immutable` cache below is still right — a key is never reused.
 *
 * A cover stored as a URL (Cloudinary) never reaches this route — `coverUrl`
 * hands the page the URL itself. If one is asked for anyway it is a 404, never
 * a fetch: a route that retrieved whatever address it was given would be an
 * open proxy on this site's origin. The store refuses it too; this is the
 * cheaper, earlier no.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/news/media/[...key]">,
) {
  const { key } = await ctx.params;
  const joined = (key ?? []).join("/");

  if (!joined || joined.includes("..") || isUrlCoverKey(joined)) {
    return new Response("Not found", { status: 404 });
  }

  let media: Awaited<ReturnType<typeof getMedia>>;
  try {
    media = await getMedia(joined);
  } catch (error) {
    // D1 unreachable. Not a 404 — that would be cached as "no such image" —
    // and not a 500 either; the image is simply unavailable for now.
    console.error("[news] media read failed:", error instanceof Error ? error.message : error);
    return new Response("Unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "30" },
    });
  }
  if (!media) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(media.bytes.byteLength),
      // A media key is content-addressed in practice: an edited cover gets a
      // new key rather than new bytes under the old one, so this can never go
      // stale. Seeded keys point at files under `public/`, which are equally
      // immutable for the life of a deployment.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
