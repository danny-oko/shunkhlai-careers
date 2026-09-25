import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk/appearance";
import { clerkLocalizationMn } from "@/lib/clerk/localization-mn";
import { PT_Serif, Ubuntu_Sans, Ubuntu_Sans_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/auth/session-provider";
import { CursorRing } from "@/components/cursor-ring";
import { ChromeSlot } from "@/components/chrome-slot";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { SHARE_IMAGE, SHARE_MOTTO } from "@/lib/share";
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

// The newsroom's reading face. `globals.css` sets `--font-serif` from
// `--font-pt-serif`, so without this every headline and article body on /news
// and /admin falls back to Georgia — and Ө/ө, Ү/ү to whatever face has them.
const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

/**
 * The origin relative Open Graph URLs resolve against. It must be this site:
 * careers.shunkhlai.mn is the company's older careers page, so resolving
 * against it pointed every link preview at an image that 404s there.
 * `NEXT_PUBLIC_SITE_URL` wins once a custom domain is live; until then
 * Vercel's production hostname is used.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Шунхлай ХХК - Careers",
    template: "%s - Шунхлай Careers",
  },
  description:
    "Шунхлай ХХК-ийн карьерын сайт. Хүний нөөц, санхүү, лаборатори, логистик, борлуулалт, маркетинг, мэдээллийн технологийн нээлттэй ажлын байр.",
  // Pages without their own `openGraph` (careers, news) share with this.
  openGraph: {
    type: "website",
    siteName: "Шунхлай ХХК - Careers",
    locale: "mn_MN",
    title: "Шунхлай ХХК - Careers",
    description: SHARE_MOTTO,
    images: [SHARE_IMAGE],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* The hosted sign-in and sign-up cards are the only Clerk UI this site
       mounts, and both hang off this provider - see `src/lib/clerk/`. */
    <ClerkProvider
      appearance={clerkAppearance}
      localization={clerkLocalizationMn}
    >
      <html
        lang="mn"
        suppressHydrationWarning
        className={`${sans.variable} ${mono.variable} ${ptSerif.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
              <SessionProvider>
                {/* `/admin` brings its own bar; the fixed site header would
                    otherwise sit on top of it and the footer under the desk. */}
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
    </ClerkProvider>
  );
}
