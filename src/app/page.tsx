import type { Metadata } from "next";

import { SiteLoader } from "@/components/landing/site-loader";
import { HeroStage } from "@/components/landing/hero-stage";
import { HeroJourney } from "@/components/landing/hero-journey";
import { getContent } from "@/lib/content/service";
import { getFilterData, listJobsSafe } from "@/lib/jobs";

/**
 * Postings are read with axios, which Next cannot see the way it sees `fetch`,
 * so without this the page would be prerendered once at build and serve the
 * same list forever. Five minutes: fresh enough for a careers site, cheap
 * enough that the recruitment API is not hit on every visit.
 * (Must stay a literal — the value has to be statically analysable.)
 *
 * The hero copy is read on the same schedule, and does not wait five minutes
 * for an edit: saving it calls `revalidatePath("/")`, which drops this window
 * so the next request renders the new wording. See
 * `src/app/admin/content/actions.ts`.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Шунхлай ХХК - Хүчирхэг монголын хөгжлийн хүрд",
  description:
    "Шунхлай ХХК-ийн карьерын сайт. 21 аймагт 99 гаруй ШТС, 8 агуулах, итгэмжлэгдсэн лаборатори - хүний нөөцөөс мэдээллийн технологи хүртэл олон салбарын нээлттэй ажлын байр.",
  openGraph: {
    title: "Шунхлай ХХК - Careers",
    description:
      "Зөвхөн шатахуунчин биш. 30 гаруй жил Монголыг хөдөлгөж ирсэн багт нэгдээрэй.",
    images: ["/brand/kv-amjilt.jpg"],
    type: "website",
  },
};

export default async function LandingPage() {
  // `getContent` never throws and never answers empty: an unwritten row or an
  // unreachable database renders the hero this page shipped with.
  const [jobs, filters, hero] = await Promise.all([
    listJobsSafe(),
    getFilterData(),
    getContent("hero"),
  ]);
  // Only the adverts taking applications, the same count the careers page
  // shows: the list also carries postings already in or past selection.
  const roleCount = jobs.filter((job) => job.isOpen).length;

  // The province list is the recruitment system's own, so anything added
  // there shows up in the opening screen without a code change. The loader's
  // division names are fixed copy and live with the component.
  const provinces = [
    ...new Set((filters?.location ?? []).map((site) => site.divisionname)),
  ];

  return (
    <main className="flex-1">
      <SiteLoader provinces={provinces} />
      <HeroStage hero={hero} roleCount={roleCount} />
      <HeroJourney />
    </main>
  );
}
