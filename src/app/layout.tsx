import type { Metadata } from "next";
import { Ubuntu_Sans, Ubuntu_Sans_Mono } from "next/font/google";
import { Geist, Geist_Mono, PT_Serif } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PaletteProvider } from "@/components/palette-provider";
import { SessionProvider } from "@/components/auth/session-provider";
import { CursorRing } from "@/components/cursor-ring";
import { ChromeSlot } from "@/components/chrome-slot";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Ubuntu Sans, not the 2010 Ubuntu it succeeds.
 *
 * The older family is static at 300/400/500/700, and this site is set in 500
 * and 600 with the footer's dot wordmark punched at 800. Against that face
 * every semibold on the site would round up to bold and the wordmark's stems
 * would thin out. Ubuntu Sans is variable from 100 to 800, so the weights the
 * design already asks for are the weights it gets.
 *
 * cyrillic-ext carries U+04E8/04E9 (Ө/ө) and U+04AE/04AF (Ү/ү), which the
 * plain cyrillic subset omits. Without it every Ө and Ү in Mongolian copy
 * falls back to a system face — checked against the shipped font files, not
 * assumed from the subset name.
 */
const sans = Ubuntu_Sans({
  variable: "--font-ubuntu-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

/**
 * The same two Cyrillic subsets, which the mono did not carry before.
 *
 * It sets the province names in the opening ticker and the км/ц readout on the
 * road — Ө and Ү among them, since a third of the provinces have one. On
 * `latin` alone those characters were dropping to a system mono mid-word.
 */
const mono = Ubuntu_Sans_Mono({
  variable: "--font-ubuntu-mono",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

// The newsroom's reading face. PT Serif is a ParaType design drawn for
// Cyrillic first, so Mongolian copy sets without the fallback-to-Georgia
// wobble a Latin-only serif produces on Ө/ө and Ү/ү. Only /news and
// /admin/news ask for it; the rest of the site stays on Geist.
const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for Open Graph images. Update if the site moves.
  metadataBase: new URL("https://careers.shunkhlai.mn"),
  title: {
    default: "Шунхлай ХХК - Careers",
    template: "%s - Шунхлай Careers",
  },
  description:
    "Шунхлай ХХК-ийн карьерын сайт. Хүний нөөц, санхүү, лаборатори, логистик, борлуулалт, маркетинг, мэдээллийн технологийн нээлттэй ажлын байр.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="mn"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {/* The colour scheme is a second, independent axis: light/dark is
              the theme, and the palette is which 60-30-10 set of colours that
              theme is drawn in. Both attributes land on <html>. */}
          <PaletteProvider>
            {/* Shared chrome lives here, so no page mounts it itself. The
                header is fixed, so pages own the top offset their own hero
                needs — the landing hero deliberately opens underneath it. */}
            <SessionProvider>
              <SiteHeader />
              {children}
              <SiteFooter />
              <Toaster position="bottom-right" />
              <CursorRing />
            </SessionProvider>
          </PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
