import { CareersHero } from "@/components/brand/careers-hero";
import { JobBrowser } from "@/components/job-browser";
import { listJobs } from "@/lib/jobs";

/**
 * Postings are read with axios, which Next cannot see the way it sees `fetch`,
 * so without this the page would be prerendered once at build and serve the
 * same list forever. Five minutes: fresh enough for a careers site, cheap
 * enough that the recruitment API is not hit on every visit.
 * (Must stay a literal — the value has to be statically analysable.)
 */
export const revalidate = 300;

export const metadata = {
  title: "Нээлттэй ажлын байр",
  description: "Шунхлай ХХК-д одоо нээлттэй байгаа бүх ажлын байр.",
};

export default async function CareersPage() {
  const jobs = await listJobs();

  return (
    <main className="flex-1 pt-16">
      <CareersHero roleCount={jobs.length} />

      <div className="mx-auto w-full max-w-6xl">
        <JobBrowser jobs={jobs} />
      </div>
    </main>
  );
}
