import type * as React from "react";

import { StoryCard } from "@/components/news/story-card";
import type { NewsArticle } from "@/lib/news/types";

/**
 * The stories under the lead, as a rail that carries itself past the reader.
 *
 * A grid asks to be read left to right and then forgotten; a rail keeps every
 * story in circulation, which is what a front page of six wants. It stops
 * under the pointer - and under the keyboard, which is the same promise for
 * anyone tabbing through it - so nothing has to be chased, and each card is
 * the same single link to the story it always was.
 *
 * The track holds the same six cards twice. `brand-marquee` translates it by
 * exactly half its width, so the moment the first set has left the frame the
 * second is standing where it started and the loop has no seam. Each half
 * carries its own trailing gap, or the join would be a gap short.
 */

/** Seconds each card is given to cross the rail. */
const PACE = 9;

export function StoryRail({ articles }: { articles: NewsArticle[] }) {
  const cards = (
    <>
      {articles.map((article) => (
        <StoryCard
          key={article.id}
          article={article}
          className="w-[17.5rem] shrink-0 sm:w-[21rem]"
          sizes="(min-width: 640px) 21rem, 17.5rem"
        />
      ))}
    </>
  );

  return (
    <div
      // Bled to the page's edges: a rail that starts and stops inside the
      // measure reads as a row that happens to move, rather than as something
      // running past the screen.
      className="brand-marquee-group relative -mx-6 overflow-hidden lg:-mx-10 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] motion-reduce:overflow-x-auto"
      style={
        { "--marquee-duration": `${articles.length * PACE}s` } as React.CSSProperties
      }
    >
      <div className="brand-marquee flex w-max">
        {/* Both halves are built the same way, down to the trailing gap: the
            track is translated by exactly half its own width, so a padding on
            one of them and not the other puts a jump in the loop. */}
        <div className="flex shrink-0 gap-7 pr-7">{cards}</div>
        {/* The second set is scenery: the same six stories, so it is out of
            the reading order and out of the tab order. Under reduced motion
            nothing moves and the rail is scrolled by hand, where a second set
            would only be the same six stories again. */}
        <div
          aria-hidden
          inert
          className="flex shrink-0 gap-7 pr-7 motion-reduce:hidden"
        >
          {cards}
        </div>
      </div>
    </div>
  );
}
