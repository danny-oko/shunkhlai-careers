import type { NewsBlock } from "@/lib/news/types";

/**
 * An article body, block by block.
 *
 * The measure is capped at 34em and the type is 1.1875rem on a desktop: about
 * 70 characters a line, which is the width a reader can return from the end of
 * one line to the start of the next without losing their place. Everything
 * here serves that one number — the quote and the list are indented *within*
 * the measure rather than breaking out of it, so the left edge of the text
 * never moves as the reader goes down the page.
 *
 * Only the first paragraph takes the drop cap. A second one would read as the
 * start of a second article.
 */
export function ArticleBody({ blocks }: { blocks: NewsBlock[] }) {
  // Found up front rather than tracked while mapping: a flag flipped inside
  // the map is a mutation during render, which the React compiler rejects —
  // and an article that opens on a heading or a quote still gets its drop cap
  // on the first paragraph rather than losing it.
  const opening = blocks.findIndex((block) => block.kind === "paragraph");

  return (
    <div className="news-body news-measure mx-auto">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === "heading") {
          return (
            <h2
              key={key}
              className="news-headline mt-10 mb-3 text-[1.375rem] sm:text-2xl"
            >
              {block.text}
            </h2>
          );
        }

        if (block.kind === "quote") {
          return (
            <blockquote key={key} className="relative my-8 pl-5">
              {/* The rule is the brand gradient rather than a flat border, so a
                  pull quote is the one place in the copy the brand appears. */}
              <span
                aria-hidden
                className="absolute top-0 left-0 h-full w-0.5"
                style={{ backgroundImage: "var(--brand-gradient)" }}
              />
              <p className="font-serif text-[1.1875rem] leading-[1.6] italic sm:text-[1.3125rem]">
                {block.text}
              </p>
              {block.attribution && (
                <footer className="mt-2.5 text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase not-italic">
                  {block.attribution}
                </footer>
              )}
            </blockquote>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={key} className="my-6 space-y-2.5 pl-1">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-[0.7em] h-px w-3 shrink-0"
                    style={{ backgroundColor: "var(--paper-accent)" }}
                  />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={key} className={index === opening ? "news-dropcap" : "mt-5"}>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
