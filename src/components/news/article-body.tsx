import * as React from "react";

import type { BlockNode, InlineNode, ListItemNode, Mark, RichDoc } from "@/lib/news/shared/rich-text";

/**
 * An article body, node by node.
 *
 * The document is a `RichDoc` and every node becomes a React element here —
 * there is no raw-HTML injection anywhere, so what can reach the page is
 * exactly what `sanitizeDoc` let into the document. The admin preview renders
 * through this same component, so the preview is the output rather than a
 * copy of it.
 *
 * The measure is capped at 34em and the type is 1.1875rem on a desktop: about
 * 70 characters a line, which is the width a reader can return from the end of
 * one line to the start of the next without losing their place. Everything
 * here serves that one number — the quote and the list are indented *within*
 * the measure rather than breaking out of it, so the left edge of the text
 * never moves as the reader goes down the page.
 *
 * Only the first paragraph takes the drop cap. A second one would read as the
 * start of a second article. Headings render one level down (h2–h4): the
 * page's own h1 is the headline.
 */

/** A quote's closing paragraph, when it starts with an em dash, is its byline. */
const BYLINE = /^\s*—\s+/u;

function hasText(content: InlineNode[] | undefined): boolean {
  return (content ?? []).some((node) => node.type === "hardBreak" || node.text.length > 0);
}

function applyMark(children: React.ReactNode, mark: Mark, key: string): React.ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong key={key}>{children}</strong>;
    case "italic":
      return <em key={key}>{children}</em>;
    case "underline":
      return <u key={key}>{children}</u>;
    case "strike":
      return <s key={key}>{children}</s>;
    case "link": {
      const { href, target } = mark.attrs;
      return (
        <a
          key={key}
          href={href}
          {...(target === "_blank" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="underline decoration-[var(--paper-accent)] underline-offset-[0.2em] hover:decoration-2"
        >
          {children}
        </a>
      );
    }
  }
}

function Inlines({ content }: { content?: InlineNode[] }) {
  return (
    <>
      {(content ?? []).map((node, index) => {
        if (node.type === "hardBreak") return <br key={index} />;
        // The first mark is outermost, as the editor writes them, and a link
        // always goes first so one link can span bold and plain runs.
        const ordered = [...(node.marks ?? [])].sort(
          (a, b) => Number(b.type === "link") - Number(a.type === "link"),
        );
        return (
          <React.Fragment key={index}>
            {ordered.reduceRight<React.ReactNode>(
              (children, mark, markIndex) => applyMark(children, mark, `${index}-${markIndex}`),
              node.text,
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

function ListItem({ item, bullet }: { item: ListItemNode; bullet: boolean }) {
  const body = (
    <Blocks blocks={item.content} inItem />
  );

  if (!bullet) return <li className="pl-1">{body}</li>;

  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-[0.7em] h-px w-3 shrink-0"
        style={{ backgroundColor: "var(--paper-accent)" }}
      />
      <div className="min-w-0 flex-1">{body}</div>
    </li>
  );
}

function Block({
  block,
  dropCap,
  inItem,
}: {
  block: BlockNode;
  dropCap: boolean;
  inItem: boolean;
}) {
  switch (block.type) {
    case "paragraph":
      if (!hasText(block.content)) return null;
      return (
        // Both edges flush. The copy runs the full width of the page now, so
        // a line holds enough words for the spaces to absorb the difference
        // without the rivers a narrow measure would open up. Headings and
        // pull quotes are set elsewhere and stay ragged: they are display
        // type, and a stretched two-line heading reads as a mistake.
        <p
          className={`text-justify ${dropCap ? "news-dropcap" : inItem ? "mt-2 first:mt-0" : "mt-5"}`}
        >
          <Inlines content={block.content} />
        </p>
      );

    case "heading": {
      if (!hasText(block.content)) return null;
      const content = <Inlines content={block.content} />;
      if (block.attrs.level === 1) {
        return (
          <h2 className="news-headline mt-10 mb-3 text-[1.375rem] sm:text-2xl">{content}</h2>
        );
      }
      if (block.attrs.level === 2) {
        return (
          <h3 className="news-headline mt-8 mb-2.5 text-[1.1875rem] sm:text-[1.3125rem]">
            {content}
          </h3>
        );
      }
      return <h4 className="mt-7 mb-2 font-serif text-[1.0625rem] font-semibold">{content}</h4>;
    }

    case "bulletList":
      return (
        <ul role="list" className="my-6 space-y-2.5 pl-1">
          {block.content.map((item, index) => (
            <ListItem key={index} item={item} bullet />
          ))}
        </ul>
      );

    case "orderedList":
      return (
        <ol
          role="list"
          start={block.attrs.start}
          className="my-6 list-decimal space-y-2.5 pl-7 marker:text-muted-foreground"
        >
          {block.content.map((item, index) => (
            <ListItem key={index} item={item} bullet={false} />
          ))}
        </ol>
      );

    case "blockquote": {
      const last = block.content[block.content.length - 1];
      const byline =
        last?.type === "paragraph" &&
        block.content.length > 1 &&
        BYLINE.test(last.content?.[0]?.type === "text" ? last.content[0].text : "")
          ? last
          : null;
      const lines = byline ? block.content.slice(0, -1) : block.content;

      return (
        <blockquote className="relative my-8 pl-5">
          {/* The rule is the brand gradient rather than a flat border, so a
              pull quote is the one place in the copy the brand appears. */}
          <span
            aria-hidden
            className="absolute top-0 left-0 h-full w-0.5"
            style={{ backgroundImage: "var(--brand-gradient)" }}
          />
          <div className="font-serif text-[1.1875rem] leading-[1.6] italic sm:text-[1.3125rem]">
            {lines.map((line, index) =>
              line.type === "paragraph" ? (
                hasText(line.content) && (
                  <p key={index} className={index === 0 ? undefined : "mt-3"}>
                    <Inlines content={line.content} />
                  </p>
                )
              ) : (
                <Block key={index} block={line} dropCap={false} inItem />
              ),
            )}
          </div>
          {byline && (
            <footer className="mt-2.5 type-kicker tracking-[0.12em] text-muted-foreground uppercase not-italic">
              <Inlines content={byline.content} />
            </footer>
          )}
        </blockquote>
      );
    }

    case "image": {
      const { src, alt, title, width, height } = block.attrs;
      return (
        <figure className="my-8">
          {/* A plain <img>: the source may be any https host the editor chose,
              and next/image refuses hosts that are not in next.config. The
              source has already passed `safeImageSrc`. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            width={width ?? undefined}
            height={height ?? undefined}
            loading="lazy"
            decoding="async"
            className="h-auto max-w-full border border-border"
          />
          {title && (
            <figcaption className="mt-2 font-sans text-[0.8125rem] leading-snug text-muted-foreground">
              {title}
            </figcaption>
          )}
        </figure>
      );
    }

    case "horizontalRule":
      return <hr className="my-10 h-px border-0 bg-[var(--rule-strong)]" />;
  }
}

function Blocks({ blocks, inItem = false }: { blocks: BlockNode[]; inItem?: boolean }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Block key={index} block={block} dropCap={false} inItem={inItem} />
      ))}
    </>
  );
}

export function ArticleBody({ doc }: { doc: RichDoc }) {
  // Found up front rather than tracked while mapping: a flag flipped inside
  // the map is a mutation during render, which the React compiler rejects —
  // and an article that opens on a heading or a quote still gets its drop cap
  // on the first paragraph rather than losing it.
  const opening = doc.content.findIndex(
    (block) => block.type === "paragraph" && hasText(block.content),
  );

  return (
    // The column the cover sets: the picture above runs the full width of
    // the page's container, so the copy is given the same edges and the two
    // end on the same line down both sides.
    <div className="news-body">
      {doc.content.map((block, index) => (
        <Block key={index} block={block} dropCap={index === opening} inItem={false} />
      ))}
    </div>
  );
}
