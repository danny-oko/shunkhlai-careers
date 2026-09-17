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
 */

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/news/media/[...key]">,
) {
  const { key } = await ctx.params;
  const joined = (key ?? []).join("/");

  if (!joined || joined.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const media = getMedia(joined);
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
