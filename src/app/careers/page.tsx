import { CareersHero } from "@/components/brand/careers-hero";
import { JobBrowser } from "@/components/job-browser";
import { getFilterData, listJobs } from "@/lib/jobs";

export const metadata = {
  title: "Нээлттэй ажлын байр",
  description: "Шунхлай ХХК-д одоо нээлттэй байгаа бүх ажлын байр.",
};

/**
 * Postings are read with axios, which Next cannot see the way it sees `fetch`.
 * Search parameters make this route dynamic anyway, so the list is always
 * current; the five-minute window only applies to the unfiltered page.
 * (Must stay a literal — the value has to be statically analysable.)
 */
export const revalidate = 300;

export default async function CareersPage({ searchParams }: PageProps<"/careers">) {
  const params = await searchParams;
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const [jobs, filterData] = await Promise.all([
    listJobs({
      jobName: read("jobName") ?? "",
      locationid: Number(read("locationid")) || 0,
      salaryLevelID: read("salaryLevelID") ?? "",
    }),
    getFilterData(),
  ]);

  const openCount = jobs.filter((job) => job.isOpen).length;

  return (
    <main className="flex-1 pt-16">
      <CareersHero roleCount={openCount} />

      <div className="mx-auto w-full max-w-6xl">
        <JobBrowser jobs={jobs} filterData={filterData} />
      </div>
    </main>
  );
}
