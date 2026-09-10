import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/auth/session-provider";
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

export const metadata: Metadata = {
  // Absolute base for Open Graph images. Update if the site moves.
  metadataBase: new URL("https://careers.shunkhlai.mn"),
  title: {
    default: "Шунхлай ХХК — Careers",
    template: "%s — Шунхлай Careers",
  },
  description:
    "Шунхлай ХХК-ийн карьерын сайт. Хүний нөөц, санхүү, лаборатори, логистик, борлуулалт, маркетинг, мэдээллийн технологийн нээлттэй ажлын байр.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="mn"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
            <SiteHeader />
            {children}
            <SiteFooter />
            <Toaster position="bottom-right" />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
