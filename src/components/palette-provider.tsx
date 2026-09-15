"use client";

import * as React from "react";

import {
  DEFAULT_PALETTE,
  PALETTE_ATTRIBUTE,
  PALETTE_IDS,
  PALETTE_STORAGE_KEY,
  isPaletteId,
  nextPaletteId,
  type PaletteId,
} from "@/lib/palettes";

/**
 * Which of the 60-30-10 colour schemes the site is wearing.
 *
 * This is deliberately not a second `next-themes` provider. next-themes keeps
 * one module-level context, so nesting a second one would shadow the first and
 * `ThemeToggle` would end up driving the palette instead of light/dark. The two
 * are independent axes - any palette, in either mode - so they get independent
 * state: the palette rides on `data-palette`, the theme keeps the `dark` class.
 *
 * The swap is instantaneous, with no cross-fade. That matches the theme
 * provider, which is mounted with `disableTransitionOnChange` for the same
 * reason: a blanket transition over every element would, for its whole
 * duration, also take over the transform transitions the landing page drives
 * from the scroll position.
 */
type PaletteContextValue = {
  palette: PaletteId;
  setPalette: (id: PaletteId) => void;
  /** Steps to the next scheme, wrapping round. What the header button calls. */
  cyclePalette: () => void;
};

const PaletteContext = React.createContext<PaletteContextValue | null>(null);

export function usePalette(): PaletteContextValue {
  const value = React.useContext(PaletteContext);
  if (!value) {
    throw new Error("usePalette must be used inside <PaletteProvider>");
  }
  return value;
}

/* -------------------------------------------------------------------------
   The attribute on <html> is the state.

   Not a `useState` seeded in an effect: the inline script below has already
   written the attribute before React exists, so a state copy would start out
   wrong and have to be corrected on mount - a second render, and a lint error
   for setting state in an effect. Reading <html> through
   `useSyncExternalStore` instead lets React hydrate against the server's value
   and then pick up the real one by itself.
   ---------------------------------------------------------------------- */

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function readPalette(): PaletteId {
  const value = document.documentElement.getAttribute(PALETTE_ATTRIBUTE);
  return isPaletteId(value) ? value : DEFAULT_PALETTE;
}

/** There is no <html> to read on the server, and no stored choice to honour. */
function readServerPalette(): PaletteId {
  return DEFAULT_PALETTE;
}

function writePalette(id: PaletteId) {
  document.documentElement.setAttribute(PALETTE_ATTRIBUTE, id);
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    // Site data blocked: the reader still gets the swap, just not the memory.
  }
  for (const listener of listeners) listener();
}

/**
 * Runs before the browser paints, so a reader who picked a scheme last visit
 * never sees the default one flash first. It only moves an attribute; if
 * localStorage throws - private mode, blocked site data - the site simply opens
 * on the brandbook palette.
 */
const NO_FLASH_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  PALETTE_STORAGE_KEY,
)});if(${JSON.stringify(
  PALETTE_IDS as readonly string[],
)}.indexOf(v)>-1)document.documentElement.setAttribute(${JSON.stringify(
  PALETTE_ATTRIBUTE,
)},v)}catch(e){}})()`;

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const palette = React.useSyncExternalStore(
    subscribe,
    readPalette,
    readServerPalette,
  );

  const cyclePalette = React.useCallback(() => {
    writePalette(nextPaletteId(readPalette()));
  }, []);

  const value = React.useMemo(
    () => ({ palette, setPalette: writePalette, cyclePalette }),
    [palette, cyclePalette],
  );

  return (
    <PaletteContext.Provider value={value}>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }}
      />
      {children}
    </PaletteContext.Provider>
  );
}
