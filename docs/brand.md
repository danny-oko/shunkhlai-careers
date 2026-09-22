# Shunkhlai brand system

Extracted from **Брэндбүүк s 4** (144pp, approved by company order under
Хөдөлмөрийн дотоод журам §3.1). Section numbers below are the brandbook's own,
so any claim here can be checked against the source.

This file is the reference for `src/app/globals.css`. When the two disagree,
the brandbook wins and the CSS is the bug.

---

## 1. Colour (brandbook 1.3, 1.11)

Four brand colours are specified. Three are in the CSS today; the fourth was
missing until this document was written.

| Name | Pantone | CMYK | RGB | Hex | Token |
|---|---|---|---|---|---|
| Шунхлай оранж | 166 C | 0 / 75 / 100 / 0 | 234 / 89 / 1 | `#ea5901` | `--brand` |
| Шунхлай цайвар оранж | 151 C | 0 / 55 / 100 / 0 | 241 / 135 / 0 | `#f18700` | `--brand-2` |
| Шунхлай цэнхэр | Reflex Blue C | 100 / 70 / 0 / 0 | 0 / 77 / 158 | `#004d9e` | `--brand-blue` |
| Хөх саарал | Deep Navy Blue | 40 / 40 / 0 / 70 | 88 / 85 / 112 | `#585570` | `--brand-navy` |

**Gradient (өнгөний уусалт).** Оранж → цайвар оранж is a specified brand
device, not decoration invented for the web. `--brand-gradient`.

**Single-colour fallback (1.4.1).** Where the gradient cannot be reproduced,
collapsing it to one flat colour is explicitly permitted.

**Logo on tinted grounds (1.5, 1.5.1).**
- 0–10% tint → logo in black
- 51–100% tint → logo in white
- Full-colour logo on grey is allowed only up to a 5–10% tint

**`--ink` is not a brandbook colour.** `#06203d` / `#0b3466` are a darkened
navy invented for this site's 60-30-10 split. That is a reasonable UI decision,
but it is ours, not the brandbook's — do not describe it as brand navy. The
brandbook's own dark blue-grey is `--brand-navy` above.

---

## 1.1 Alternate colour schemes (not brandbook)

The header carries a palette button that steps the whole site through five
colour schemes. **Only the first is brandbook.** The other four are built
from 2026 trend collections - two from **Dunn-Edwards 2026 Color Trends
("A Quiet Joy")**, one from the **London Fashion Week Fall/Winter 2025-26**
palette - and like `--ink` they are ours, not the brandbook's - do not describe them as
brand colours or use them in print.

Each scheme fills the same three roles the site is built on and changes
nothing else, so the 60-30-10 split is identical in all four:

| Scheme | 60% ground | 30% ink panel | 10% accent |
|---|---|---|---|
| `shunkhlai` | White | `#06203d` navy | `#ea5901` orange |
| `viridian` | Country Air tint | Viridian Odyssey | Cedar Grove `#bf6955` |
| `london` | LFW lavender tint | LFW plum `#4e2b3a` | LFW ochre, re-cut to `#c57100` |
| `charcoal` | Eagle's View tint | `#17181a` charcoal | Viridian Odyssey's hue, lightened |
| `wine` | LFW off-white `#f0f0ee` | LFW maroon, deepened to `#3a1f1f` | LFW mustard `#9c8438` |

The nine published colours, as Dunn-Edwards gives them:

| Colour | Code | Hex | Where it lands |
|---|---|---|---|
| Viridian Odyssey | DE1925 | `#2e484f` | `viridian` `--ink-2`, verbatim; `charcoal` accent hue |
| Gothic Revival Green | DET507 | `#a0a160` | **not used** - see below |
| Eagle's View | DE6394 | `#d4cbcc` | `charcoal` `--muted`, verbatim |
| Country Air | DET581 | `#9fb6c6` | `viridian` `--border`, verbatim |
| Gypsum Rose | DET452 | `#e2c4af` | **not used** |
| Cedar Grove | DE5152 | `#bf6955` | `viridian` `--brand`, verbatim |
| Sonoma Chardonnay | DET471 | `#ddcb91` | **not used** |
| Antique Coin | DE6270 | `#b5b8a8` | **not used** - see below |
| Purple Prose | DET405 | `#554348` | **not used** |

Note that the published hexes are markedly softer than the swatch artwork in
the collection's promotional image - work from the codes above, not from a
screenshot of the drops.

The values live in `src/app/globals.css` under `[data-palette="..."]`; the list
the UI walks is `src/lib/palettes.ts`. `shunkhlai` has no CSS block: it is what
`:root` and `.dark` already say, so with no attribute set the site is exactly
what it was before the button existed.

### Why no paint colour can be the panel it looks like

A full-bleed `--ink` panel has to carry `--ink-foreground` at 4.5:1 *and* leave
an accent enough room to clear 3:1 against both the panel and the page. That
second condition is a window, and it closes fast:

| Scheme | Ink used verbatim | Accent luminance window |
|---|---|---|
| `viridian` | Viridian Odyssey `#2e484f` | 0.279 .. 0.260 - **empty** |
| `charcoal` | Gothic Revival Green `#a0a160` | 1.134 .. 0.244 - **empty** |

So in each scheme the published colour becomes `--ink-2` and `--ink` is a
deepened cut of it. Deepening `viridian` to `#16292e` opens the window to
0.162 .. 0.260, which Cedar Grove fits at 0.218 with no adjustment at all.

### The two London Fashion Week schemes

`london` and `wine` come from a different kind of source and are documented
differently.
The collection circulates as artwork, not as a code list, so its values are
**read off the swatches** rather than published by anyone. They are this
file's own numbers; do not cite them as brand values the way the DE codes can
be cited.

| Role | Value | From |
|---|---|---|
| 60% ground | `#eeeef5` | a tint of the palette's pale lavender `#c5c4d8` |
| `--muted` | `#c5c4d8` | that lavender, as shown |
| 30% panel | `#2c1821`, with `#4e2b3a` at `--ink-2` | the palette's deep plum |
| 10% accent | `#c57100` | its ochre `#ce8125`, re-cut (see below) |
| `--brand-2` | `#e23744` | its red, as shown - the gradient sweeps ochre through red |

The plum is nearly usable as `--ink` untouched: at `#4e2b3a` the accent window
is 0.214 .. 0.248, the only colour in any of these collections that does not
close it outright. It was still deepened for `--ink`, because a 0.034-wide
window leaves no room for a later accent change; at `#2c1821` the window opens
to 0.142 .. 0.248.

`wine` is the same palette's warm half, and the one scheme here that puts a
chromatic warm dark on the panels:

| Role | Value | From |
|---|---|---|
| 60% ground | `#f0f0ee` | the palette's off-white, as shown |
| 30% panel | `#3a1f1f`, with `#5f3232` at `--ink-2` | its maroon |
| 10% accent | `#9c8438` | its mustard, as shown |
| `--brand-2` | `#ce8125` | its ochre, as shown |
| `--border` | `#adacaa` | its light grey, as shown |

Four of the five land untouched. The maroon does not: at `#5f3232` the window
measured 0.253 .. 0.250, shut by three thousandths, which is the narrowest
miss in this file. Deepening `--ink` to `#3a1f1f` opens it to 0.163 .. 0.250,
and the mustard fits at 0.239 with no adjustment.

### Two colours are deliberately unused

Of the Dunn-Edwards nine, **Gothic Revival Green** `#a0a160` and **Antique
Coin** `#b5b8a8` are out, along with the three that went with the retired
`plum` scheme (Gypsum Rose, Sonoma Chardonnay, Purple Prose).
The `charcoal` scheme was built around Gothic Revival Green: too light for a
panel, so it sat at `--ink-muted` over a deepened cut of itself. Seen at
full-bleed size on the landing page the olive read as drab rather than
botanical, and the scheme was rebuilt on a neutral charcoal panel instead.
Antique Coin went with it - a sage border is the same note, quieter. Do not
reintroduce either as a surface without looking at the landing page first;
these two are the set's lowest-chroma mid-tones and that is where they fail.

### Moving an accent without draining it

Two accents had to be moved in lightness. **Mixing toward black or white is the
wrong way to do it** - it pulls chroma out along with the lightness, and that
is what turns Sonoma Chardonnay into khaki (`#837856`) and Viridian Odyssey
into grey (`#738589`). Both were instead re-cut in OKLCH at the source hue,
taking the most saturated version that still fits in sRGB at the needed
luminance: Chardonnay to `#a08200`, Viridian to `#0090ac`.

Every pair that carries text was measured, not eyeballed: body text, muted
text, both ink panels and the CTA clear WCAG AA in all four schemes in both
light and dark, and all three new schemes have a *higher* CTA contrast than the
brandbook palette's own 3.54 (white on `#ea5901`).

---

## 2. Typography (brandbook 1.12, 1.12.1, 1.12.2)

Three typefaces, each with a defined job:

| Typeface | Brandbook role | Applies to the web? |
|---|---|---|
| **PF BeauSans Pro** | Logo wordmark (1.12) | Logo artwork only |
| **Times New Roman** | Official correspondence, албан бичиг (1.12.1) | No |
| **Mogul Freeset** | Advertising and marketing material (1.12.2) | **Yes — this is us** |

A careers site is сурталчилгааны материал, so the brandbook's answer for body
text is **Mogul Freeset**, with all four styles specified (Regular, Italic,
Bold, Bold Italic) in both Cyrillic and Latin.

### The gap, stated plainly

The site currently sets **Geist**. Neither Mogul Freeset nor PF BeauSans Pro is
a Google Font; both are commercial licences, and neither has a webfont licence
in this repo. So the site is not on brand typographically, and cannot be until
someone buys a webfont licence.

Three honest options, in the order I would take them:

1. **Licence Mogul Freeset for web** and self-host under `src/app/fonts/`.
   Only route that is actually on brand. Needs a purchase decision and a check
   that the licence covers Cyrillic Ө/Ү.
2. **Stay on Geist and record it as a deliberate substitution.** Geist is a
   neutral grotesque, close enough in tone not to fight the brand, and it
   covers Mongolian Cyrillic. This is the current state — the point is to make
   it a decision rather than an accident.
3. Use Mogul Freeset for headings only, licensed as a display cut. Cheaper,
   keeps the brand voice where it is most visible.

Do not substitute a lookalike and call it Mogul Freeset.

### Mongolian Cyrillic coverage — a live bug

`src/app/layout.tsx` loads Geist with `subsets: ["latin", "cyrillic"]`.

Google's `cyrillic` subset is `U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1,
U+2116`. That covers **Ү/ү** (U+04B0-04B1) but **not Ө/ө** (U+04E8-04E9), which
live in `cyrillic-ext` (`U+0460-052F`).

Ө appears in ordinary Mongolian constantly — өөрчлөх, хөгжил, өнгө, өргөн,
төлөө. Every one of those characters is currently rendering in a system
fallback face while the rest of the word renders in Geist.

Fix: add `"cyrillic-ext"` to the subsets array. One line, and it applies
whatever face is chosen above.

---

## 3. Voice (brandbook p.4)

Straight from the brandbook, for use as page copy rather than paraphrase:

- **Эрхэм зорилго (mission):** Бид хүнийг дээдэлж, эрчимтэй хөгжлийг бүтээнэ.
- **Хэтийн зорилго (vision):** Шунхлай нь 2020 он гэхэд нийгмийн хариуцлагыг
  дээд зэргээр хангасан, ногоон хөгжлийг дэмжигч, Азийн жишигт хүрсэн
  үйлчилгээтэй компани болно.
- **Уриа (slogan):** Хүчирхэг монголын хөгжлийн хүрд
- **Үнэт зүйл (values):**
  - Хэрэглэгчээ дээдлэх
  - Хүн бүр бүтээлч байх
  - Хүрээлэн буй орчноо хайрлан хамгаалах
  - Хамтын ажиллагааг эрхэмлэх
  - Хариуцлагатай байх

The five values are the natural spine for a careers page — they are what the
company has already committed to saying about working there.

Note: the vision text targets 2020 and is now out of date. Reproduce it
verbatim or ask marketing for the current wording; do not quietly modernise it.

---

## 4. Logo (brandbook 1.6, 1.7)

- **Minimum size:** 2.5mm × 2.5mm absolute floor; 5mm × 5mm in practice.
  No maximum, provided proportions hold.
- **Prohibited (1.7), all nine:** distorting proportions, overlapping its
  parts, skewing or breaking symmetry, recolouring the wordmark or mark,
  applying a different colour, colouring its containing frame, adding a shadow,
  adding elements, or using a fragment of it on its own.

Practical consequence for the site: no CSS `filter`, `drop-shadow`,
`mix-blend-mode`, or partial crop on the logo. If a dark background needs a
different logo, use the correct approved asset — do not invert the existing one.

---

## 5. What is not yet extracted

Honest list of what a second pass should cover, so nobody assumes this file is
complete:

- 1.14 / 1.15 graphic elements and the бэлгэдэл хээ pattern
- 1.16 the layout grid (загварын тор)
- 1.17 infographic style
- §2 photography rules beyond "CMYK, avoid over-dark and over-bright frames"

These are figure-heavy pages; text extraction gets the captions but not the
geometry. They need someone to read the PDF pages directly.
