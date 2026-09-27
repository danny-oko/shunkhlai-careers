import { CULTURE_WALLS, type ContentKey, type CultureWall } from "./schema";

/**
 * The admin form's flat field names, read back into the nested document the
 * section schemas expect.
 *
 * The lists are posted as `slides.0.caption`, `contacts.2.value` and so on —
 * ordinary named inputs rather than one hidden JSON blob — so the form still
 * submits and still validates with JavaScript off, and so a zod issue path
 * (`slides.0.caption`) *is* the name of the input the message belongs under.
 * `contentFieldErrors` relies on exactly that.
 *
 * Pure, and free of `next/*`: this is the half of the save worth unit-testing
 * without a request around it.
 *
 * Every value comes out as a string. Nothing here coerces, trims or defaults —
 * the schema does all of that, and a reader that quietly repaired input would
 * be a second, undocumented set of rules.
 */

type Fields = readonly string[];

function str(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The rows of one list, in index order.
 *
 * Indices are read off the field names rather than counted, because a row
 * removed in the browser leaves a gap: the form posts `0`, `2`, `3` and the
 * list is still those three rows in that order, not four with a hole.
 *
 * A row whose every field is blank is dropped. That is what makes "clear the
 * row" a way to delete one without JavaScript — and it keeps a blank row an
 * admin left behind from failing the save with three "required" messages
 * against a row they did not want.
 */
function rows(data: FormData, prefix: string, fields: Fields): Array<Record<string, string>> {
  const pattern = new RegExp(`^${prefix}\\.(\\d+)\\.(${fields.join("|")})$`, "u");
  const found = new Set<number>();

  for (const name of data.keys()) {
    const match = pattern.exec(name);
    if (match) found.add(Number(match[1]));
  }

  return [...found]
    .sort((a, b) => a - b)
    .map((index) =>
      Object.fromEntries(fields.map((field) => [field, str(data, `${prefix}.${index}.${field}`)])),
    )
    .filter((row) => Object.values(row).some((value) => value.trim() !== ""));
}

/** The indices a list's names carry — `prefix.3.…` — in order, gaps and all. */
function indices(data: FormData, pattern: RegExp): number[] {
  const found = new Set<number>();
  for (const name of data.keys()) {
    const match = pattern.exec(name);
    if (match) found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * One culture wall's tiles, from `walls.academy.items.3.title` and friends.
 *
 * Two levels deep where `rows` is one: a tile is a row, and its photographs
 * are a list inside it (`walls.academy.items.3.images.1`). The same two rules
 * hold at both levels — indices are read off the names so a removed row
 * leaves a gap rather than a hole, and a blank one is dropped rather than
 * failing the save as "required".
 */
function cultureTiles(data: FormData, wall: CultureWall) {
  const prefix = `walls.${wall}.items`;

  return indices(data, new RegExp(`^walls\\.${wall}\\.items\\.(\\d+)\\.`, "u"))
    .map((index) => {
      const base = `${prefix}.${index}`;
      const images = indices(data, new RegExp(`^${base.replace(/\./gu, "\\.")}\\.images\\.(\\d+)$`, "u"))
        .map((image) => str(data, `${base}.images.${image}`))
        .filter((src) => src.trim() !== "");

      return {
        title: str(data, `${base}.title`),
        subtitle: str(data, `${base}.subtitle`),
        body: str(data, `${base}.body`),
        images,
        logo: str(data, `${base}.logo`),
      };
    })
    .filter(
      (tile) =>
        tile.images.length > 0 ||
        [tile.title, tile.subtitle, tile.body, tile.logo].some((value) => value.trim() !== ""),
    );
}

/**
 * One section's document, as posted. Unvalidated on purpose — the caller
 * hands it straight to that section's zod schema, which is the only thing
 * that decides whether it is a `hero`.
 */
export function formDocument(key: ContentKey, data: FormData): unknown {
  if (key === "hero") {
    return {
      heading: str(data, "heading"),
      slides: rows(data, "slides", ["src", "caption", "alt"]),
      primaryCta: { label: str(data, "primaryCta.label"), href: str(data, "primaryCta.href") },
      secondaryCta: {
        label: str(data, "secondaryCta.label"),
        href: str(data, "secondaryCta.href"),
      },
    };
  }

  if (key === "footer") {
    return {
      address: str(data, "address"),
      addressUrl: str(data, "addressUrl"),
      contacts: rows(data, "contacts", ["label", "value", "href"]),
    };
  }

  if (key === "history") {
    return { entries: rows(data, "entries", ["year", "title", "body", "image", "alt"]) };
  }

  if (key === "culture") {
    return {
      heading: str(data, "heading"),
      walls: Object.fromEntries(
        CULTURE_WALLS.map((wall) => [
          wall,
          { label: str(data, `walls.${wall}.label`), items: cultureTiles(data, wall) },
        ]),
      ),
    };
  }

  return {
    heading: str(data, "heading"),
    items: rows(data, "items", ["value", "label"]),
  };
}
