import type { Metadata } from "next";

import { AboutHero } from "@/components/aboutUs/about-hero";
import { HistoryTimeline } from "@/components/aboutUs/history-timeline";
import { VisionMission } from "@/components/aboutUs/vision-mission";
import { CoreValues } from "@/components/aboutUs/core-values";
import { AcademyProgram } from "@/components/aboutUs/academy-program";
import { BenefitsGrid } from "@/components/aboutUs/benefits-grid";
import { HobbyClubs } from "@/components/aboutUs/hobby-clubs";
import { LifeGallery } from "@/components/aboutUs/life-gallery";
import { AboutCta } from "@/components/aboutUs/about-cta";
import { jobs } from "@/lib/mock-jobs";

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

export default function AboutPage() {
  return (
    <main className="flex-1">
      <AboutHero />
      <HistoryTimeline />
      <VisionMission />
      <CoreValues />
      <AcademyProgram />
      <BenefitsGrid />
      <HobbyClubs />
      <LifeGallery />
      <AboutCta roleCount={jobs.length} />
    </main>
  );
}
