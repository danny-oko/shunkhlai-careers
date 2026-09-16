import { type NewsCategory, categoryLabel } from "@/lib/news/types";
import { cn } from "@/lib/utils";

/** The desk a story came off, set above its headline. */
export function Kicker({
  category,
  className,
}: {
  category: NewsCategory;
  className?: string;
}) {
  return <p className={cn("news-kicker", className)}>{categoryLabel(category)}</p>;
}
