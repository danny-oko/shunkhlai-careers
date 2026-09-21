import type { Metadata } from "next";
import { HistoryTimeline } from "@/components/aboutUs/history-timeline";
import { StatementBands } from "@/components/aboutUs/statement-bands";
import { CultureSection } from "@/components/aboutUs/culture-section";
import { LifeGallery } from "@/components/aboutUs/life-gallery";

export const metadata: Metadata = {
  title: "Бидний тухай",
  description:
    "1993 оноос хойшхи Шунхлай ХХК-ийн түүх, алсын хараа, эрхэм зорилго, үнэт зүйл, сургалт хөгжлийн хөтөлбөр, ажилтны хөнгөлөлт хангамж, хобби клубууд.",
  openGraph: {
    title: "Бидний тухай - Шунхлай ХХК",
    description:
      "Авто засварын багаас улс даяарх сүлжээ хүртэл: Шунхлай ХХК-ийн түүх, соёл, ажилтны түүхүүд.",
    images: ["/brand/story-station-operator.jpg"],
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main className="flex-1">
      {/* The page opens on a pinned section rather than a heading, as the
          landing page does; this is the page's own name for a reader who is
          not looking at it. */}
      <h1 className="sr-only">Бидний тухай - Шунхлай ХХК</h1>

      <HistoryTimeline />
      {/* Closes on the Academy's 70/20/10 principle: the section's own label
          takes the screen and breaks apart to leave it standing. What that
          principle came to in figures is below the culture wall instead. */}
      <StatementBands />
      {/* Closes on itself: the wall turns, the pictures gather into the
          company's mark, and the Academy's figures for the year come up
          behind it. */}
      <CultureSection />
      <LifeGallery />
    </main>
  );
}
