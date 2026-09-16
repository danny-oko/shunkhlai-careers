import type { Metadata } from "next";
import { Geist, Geist_Mono, PT_Serif } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/auth/session-provider";
import { CursorRing } from "@/components/cursor-ring";
import { ChromeSlot } from "@/components/chrome-slot";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  // cyrillic-ext carries U+04E8/04E9 (Ө/ө), which the plain cyrillic subset
  // omits. Without it every Ө in Mongolian copy falls back to a system face.
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${ptSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {/* Shared chrome lives here, so no page mounts it itself. The
              header is fixed, so pages own the top offset their own hero
              needs — the landing hero deliberately opens underneath it. */}
          <SessionProvider>
            <ChromeSlot>
              <SiteHeader />
            </ChromeSlot>
            {children}
            <ChromeSlot>
              <SiteFooter />
            </ChromeSlot>
            <Toaster position="bottom-right" />
            <CursorRing />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
