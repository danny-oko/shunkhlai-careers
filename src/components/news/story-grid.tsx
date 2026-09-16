import { StoryCard } from "@/components/news/story-card";
import type { NewsArticle } from "@/lib/news/types";
import { cn } from "@/lib/utils";

/**
 * Stories in columns, with the rules between them.
 *
 * The column rules are the reason this is its own component. They cannot be
 * `divide-x`: in a wrapping grid that draws a line down the left of the first
 * cell of every row after the first. Which cell needs which border depends on
 * the column count, and the column count changes at two breakpoints, so the
 * classes are computed from the index for all three cases at once — one column
 * below `sm`, two to `lg`, three above.
 */
export function StoryGrid({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, index) => (
        <StoryCard
          key={article.id}
          article={article}
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw"
          className={cn(
            // One column: every story after the first sits under a rule.
            index > 0 && "border-t border-border pt-8",
            // Two columns: the rule moves to the left of the right-hand cell,
            // and only rows after the first keep a rule above them.
            index > 1 ? "sm:border-t sm:pt-8" : "sm:border-t-0 sm:pt-0",
            index % 2 === 1
              ? "sm:border-l sm:border-border sm:pl-7"
              : "sm:border-l-0 sm:pl-0",
            // Three columns: same rule, one column wider.
            index > 2 ? "lg:border-t lg:pt-8" : "lg:border-t-0 lg:pt-0",
            index % 3 === 0 ? "lg:border-l-0 lg:pl-0" : "lg:border-l lg:pl-7",
          )}
        />
      ))}
    </div>
  );
}
