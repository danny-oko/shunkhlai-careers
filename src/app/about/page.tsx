import type { Metadata } from "next";

import { AboutHero } from "@/components/aboutUs/about-hero";
import { HistoryTimeline } from "@/components/aboutUs/history-timeline";
import { CultureSection } from "@/components/aboutUs/culture-section";
import { LifeGallery } from "@/components/aboutUs/life-gallery";
import { AboutCta } from "@/components/aboutUs/about-cta";
import { listJobsSafe } from "@/lib/jobs";

/**
 * Postings are read with axios, which Next cannot see the way it sees `fetch`,
 * so without this the page would be prerendered once at build and serve the
 * same list forever. Five minutes: fresh enough for a careers site, cheap
 * enough that the recruitment API is not hit on every visit.
 * (Must stay a literal — the value has to be statically analysable.)
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Бидний тухай",
  description:
    "1993 оноос хойшхи Шунхлай ХХК-ийн түүх, алсын хараа, эрхэм зорилго, үнэт зүйл, сургалт хөгжлийн хөтөлбөр, ажилтны хөнгөлөлт хангамж, хобби клубууд.",
  openGraph: {
    title: "Бидний тухай — Шунхлай ХХК",
    description:
      "Авто засварын багаас улс даяарх сүлжээ хүртэл: Шунхлай ХХК-ийн түүх, соёл, ажилтны түүхүүд.",
    images: ["/brand/story-station-operator.jpg"],
    type: "website",
  },
};

export default async function AboutPage() {
  const jobs = await listJobsSafe();

  return (
    <main className="flex-1">
      <AboutHero />
      <HistoryTimeline />
      <CultureSection />
      <LifeGallery />
      <AboutCta roleCount={jobs.length} />
    </main>
  );
}
