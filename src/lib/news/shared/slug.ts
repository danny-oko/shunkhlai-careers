/**
 * Mongolian Cyrillic titles into URL slugs.
 *
 * Percent-encoded Cyrillic in a URL is technically legal and practically
 * miserable: it breaks when pasted into chat, doubles in length in analytics,
 * and is unreadable in a share card. So titles are transliterated.
 *
 * The scheme is the common Mongolian romanisation (MNS 5217 in spirit, not to
 * the letter — that standard uses diacritics no URL wants). It is deliberately
 * lossy and one-way: nothing ever reads a slug back into Cyrillic, because the
 * id in the record is what identifies an article.
 */

/**
 * Order matters: the two-character sequences would otherwise be consumed one
 * letter at a time, so they are replaced first.
 */
const DIGRAPHS: ReadonlyArray<[RegExp, string]> = [
  [/Щ/gu, "Sch"],
  [/щ/gu, "sch"],
];

const LETTERS: Readonly<Record<string, string>> = {
  А: "A", а: "a",
  Б: "B", б: "b",
  В: "V", в: "v",
  Г: "G", г: "g",
  Д: "D", д: "d",
  // Mongolian takes Е as a plain vowel — "терминал" is *terminal*, not
  // *tyerminal*. The "ye" reading belongs to Russian, and a slug that
  // spells it that way stops matching what a reader would search for.
  Е: "E", е: "e",
  Ё: "Yo", ё: "yo",
  Ж: "J", ж: "j",
  З: "Z", з: "z",
  И: "I", и: "i",
  Й: "I", й: "i",
  К: "K", к: "k",
  Л: "L", л: "l",
  М: "M", м: "m",
  Н: "N", н: "n",
  О: "O", о: "o",
  Ө: "O", ө: "o",
  П: "P", п: "p",
  Р: "R", р: "r",
  С: "S", с: "s",
  Т: "T", т: "t",
  У: "U", у: "u",
  Ү: "U", ү: "u",
  Ф: "F", ф: "f",
  Х: "H", х: "h",
  Ц: "Ts", ц: "ts",
  Ч: "Ch", ч: "ch",
  Ш: "Sh", ш: "sh",
  // The hard and soft signs carry no sound of their own: they drop out.
  Ъ: "", ъ: "",
  Ы: "Y", ы: "y",
  Ь: "", ь: "",
  Э: "E", э: "e",
  Ю: "Yu", ю: "yu",
  Я: "Ya", я: "ya",
};

const MAX_LENGTH = 72;

/** Every slug that transliterates to nothing lands here rather than on "". */
const FALLBACK = "medee";

function transliterate(input: string): string {
  let text = input;
  for (const [pattern, replacement] of DIGRAPHS) text = text.replace(pattern, replacement);
  return [...text].map((character) => LETTERS[character] ?? character).join("");
}

/**
 * Cyrillic to latin, lowercased, dash-joined, capped at 72 characters.
 *
 * The cap lands on a dash rather than mid-word: a slug is read by people in
 * search results, and a truncated syllable looks like a bug.
 */
export function slugify(title: string): string {
  const slug = transliterate(title ?? "")
    .toLowerCase()
    // Anything that is not an ASCII letter or digit becomes a separator. Latin
    // titles and numbers survive untouched; stray Cyrillic that fell through
    // the table does not become a percent-escape.
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  if (!slug) return FALLBACK;
  if (slug.length <= MAX_LENGTH) return slug;

  const cut = slug.slice(0, MAX_LENGTH);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/u, "");
}

/**
 * The same title twice is normal — "Шинэ салбар нээлээ" is a headline that
 * recurs — so a collision suffixes rather than fails.
 *
 * `keep` is the slug the article already holds: re-saving an article must not
 * bump it to `-2` against itself, and a published URL must not move because
 * someone fixed a typo elsewhere in the record.
 */
export function uniqueSlug(title: string, taken: Iterable<string>, keep?: string): string {
  const base = slugify(title);
  const used = new Set(taken);
  if (keep) used.delete(keep);

  if (!used.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
