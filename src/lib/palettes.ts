/**
 * The colour schemes behind the palette button in the header.
 *
 * Every scheme keeps the site's 60-30-10 split intact - a neutral ground at
 * 60%, an "ink" panel colour at 30%, one accent at 10% - and only swaps which
 * colours fill those three roles. The token values themselves live in
 * `src/app/globals.css` under `[data-palette="..."]`; this file is only the
 * list the UI walks and the contract for the id that goes on <html>.
 *
 * `shunkhlai` is the brandbook palette and stays exactly as it was. The other
 * four come from 2026 trend collections - two from Dunn-Edwards, one from
 * London Fashion Week - each chosen so the three roles keep the contrast the
 * brandbook palette already had. See docs/brand.md §1.1.
 */
export const PALETTE_IDS = ["shunkhlai", "viridian", "london", "charcoal", "wine"] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

export type Palette = {
  id: PaletteId;
  /** Shown to the reader, in the button's label and tooltip. */
  label: string;
  /** Where the three colours come from, so the tooltip can cite it. */
  source: string;
};

export const PALETTES: readonly Palette[] = [
  {
    id: "shunkhlai",
    label: "Шунхлай",
    source: "Брэндбүүк 1.3 - цагаан, хөх, оранж",
  },
  {
    id: "viridian",
    label: "Виридиан",
    source: "Dunn-Edwards 2026 - Viridian Odyssey, Cedar Grove",
  },
  {
    id: "london",
    label: "Лондон",
    source: "London Fashion Week FW 2025-26 - ягаан, лаванда, охра",
  },
  {
    id: "charcoal",
    label: "Нүүрсэн саарал",
    source: "Dunn-Edwards 2026 - Eagle's View, Viridian Odyssey",
  },
  {
    id: "wine",
    label: "Дарсан улаан",
    source: "London Fashion Week FW 2025-26 - хүрэн, охра",
  },
];

export const DEFAULT_PALETTE: PaletteId = "shunkhlai";

/** Namespaced the way the rest of this site's localStorage keys are. */
export const PALETTE_STORAGE_KEY = "shunkhlai.palette";

/** The attribute the schemes hang off, set on <html>. */
export const PALETTE_ATTRIBUTE = "data-palette";

export function isPaletteId(value: unknown): value is PaletteId {
  return (
    typeof value === "string" &&
    (PALETTE_IDS as readonly string[]).includes(value)
  );
}

export function getPalette(id: PaletteId): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/** Wraps round, so the button can just keep being pressed. */
export function nextPaletteId(id: PaletteId): PaletteId {
  const at = PALETTE_IDS.indexOf(id);
  return PALETTE_IDS[(at + 1) % PALETTE_IDS.length];
}
