import { NextResponse } from "next/server";

import { getPublishedArticles } from "@/lib/news/service";
import { bodyExcerpt, coverUrl, isNewsCategory } from "@/lib/news/types";

/**
 * The newsroom, as JSON.
 *
 * Nothing in this app needs it — the pages read the store directly through
 * `service.ts`, which is faster and works during a render that happens before
 * the server is listening. It exists because the newsroom is the first thing
 * on this site another surface might want (an intranet homepage, a screen in
 * reception), and because it makes the feature testable with `curl`.
 *
 * Published only, and the body is replaced by an excerpt: a list endpoint that
 * ships every article in full is a payload nobody asked for, and drafts are
 * unpublished work that must not leave the building.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const category = params.get("category");
  const limit = Number(params.get("limit"));

  const articles = await getPublishedArticles({
    category: isNewsCategory(category) ? category : null,
    search: params.get("search") ?? "",
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
  });

  return NextResponse.json({
    articles: articles.map(({ body, coverKey, ...article }) => ({
      ...article,
      excerpt: bodyExcerpt(body),
      coverUrl: coverUrl(coverKey),
    })),
  });
}
