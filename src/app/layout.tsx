import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Ubuntu_Sans, Ubuntu_Sans_Mono } from "next/font/google";
  import { ThemeProvider } from "@/components/theme-provider";
import { PaletteProvider } from "@/components/palette-provider";
import { SessionProvider } from "@/components/auth/session-provider";
// import { CursorRing } from "@/components/cursor-ring";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Ubuntu_Sans({
  variable: "--font-ubuntu-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

const mono = Ubuntu_Sans_Mono({
  variable: "--font-ubuntu-mono",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export const metadata: Metadata = {
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
    <ClerkProvider>
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
            <PaletteProvider>
              <SessionProvider>
                <SiteHeader />
                {children}
                <SiteFooter />
                <Toaster position="bottom-right" />
              </SessionProvider>
            </PaletteProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
