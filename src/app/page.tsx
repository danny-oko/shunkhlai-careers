import type { Metadata } from "next";

import { SiteLoader } from "@/components/landing/site-loader";
import { HeroStage } from "@/components/landing/hero-stage";
import { HeroJourney } from "@/components/landing/hero-journey";
import { CompanyStats } from "@/components/landing/company-stats";
import { RoleSpectrum } from "@/components/landing/role-spectrum";
import { FeaturedRoles } from "@/components/landing/featured-roles";
import { AcademyVoices } from "@/components/landing/academy-voices";
import { JourneyCta } from "@/components/landing/journey-cta";
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

export default async function LandingPage() {
  const jobs = await listJobsSafe();
  const roleCount = jobs.length;

  return (
    <main className="flex-1">
      <SiteLoader />
      <HeroStage roleCount={roleCount} />
      <HeroJourney />
      <CompanyStats />
      <RoleSpectrum />
      <FeaturedRoles jobs={jobs} />
      <AcademyVoices />
      <JourneyCta roleCount={roleCount} />
    </main>
  );
}
