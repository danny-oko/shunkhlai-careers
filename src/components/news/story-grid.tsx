import { StoryCard } from "@/components/news/story-card";
import type { NewsArticle } from "@/lib/news/types";

/**
 * Stories in columns.
 *
 * It used to draw hairline rules above and between the cells, which is how a
 * broadsheet keeps columns of type apart. That was the single most expensive
 * thing in this folder - which cell needed which border depended on the column
 * count, the column count changed at two breakpoints, so every cell computed
 * six classes from its index to get three cases right at once.
 *
 * All of it was in service of an effect the page no longer wants. A grid of
 * photographs with space between them is already read as separate items; the
 * rules were what made three cards look like three columns of one page. With
 * them gone the gutter does the work, and the component is the grid it always
 * was underneath.
 */
export function StoryGrid({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <StoryCard
          key={article.id}
          article={article}
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw"
        />
      ))}
    </div>
  );
}
