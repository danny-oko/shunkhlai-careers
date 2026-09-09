import type { Metadata } from "next";

import { SiteLoader } from "@/components/landing/site-loader";
import { HeroStage } from "@/components/landing/hero-stage";
import { HeroJourney } from "@/components/landing/hero-journey";
import { CompanyStats } from "@/components/landing/company-stats";
import { RoleSpectrum } from "@/components/landing/role-spectrum";
import { FeaturedRoles } from "@/components/landing/featured-roles";
import { AcademyVoices } from "@/components/landing/academy-voices";
import { JourneyCta } from "@/components/landing/journey-cta";
import { jobs } from "@/lib/mock-jobs";

export const metadata: Metadata = {
  title: "Шунхлай ХХК — Хөдөлмөр хөгжлийн хөдөлгүүр",
  description:
    "Шунхлай ХХК-ийн карьерын сайт. 21 аймагт 99 гаруй ШТС, 8 агуулах, итгэмжлэгдсэн лаборатори — хүний нөөцөөс мэдээллийн технологи хүртэл олон салбарын нээлттэй ажлын байр.",
  openGraph: {
    title: "Шунхлай ХХК — Careers",
    description:
      "Зөвхөн шатахуунчин биш. 30 гаруй жил Монголыг хөдөлгөж ирсэн багт нэгдээрэй.",
    images: ["/brand/kv-amjilt.jpg"],
    type: "website",
  },
};

export default function LandingPage() {
  const roleCount = jobs.length;

  return (
    <main className="flex-1">
      <SiteLoader />
      <HeroStage roleCount={roleCount} />
      <HeroJourney />
      <CompanyStats />
      <RoleSpectrum />
      <FeaturedRoles />
      <AcademyVoices />
      <JourneyCta roleCount={roleCount} />
    </main>
  );
}
