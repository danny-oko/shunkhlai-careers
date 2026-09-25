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
