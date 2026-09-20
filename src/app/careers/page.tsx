import { CareersHero } from "@/components/brand/careers-hero";
import { JobBrowser } from "@/components/job-browser";
import { getFilterData, listJobs } from "@/lib/jobs";
import type { Job } from "@/lib/jobs";
import type { JobQuery } from "@/lib/api/jobs";

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

/** The postings, or `null` when the backend could not be reached. */
async function loadJobs(query: JobQuery): Promise<Job[] | null> {
  try {
    return await listJobs(query);
  } catch (error) {
    console.error("[careers] could not load postings", error);
    return null;
  }
}

type SearchParams = Awaited<PageProps<"/careers">["searchParams"]>;

/** The URL's filters as a posting query. */
function toQuery(params: SearchParams): JobQuery {
  const read = (key: string) => [params[key]].flat()[0] ?? "";
  return {
    jobName: read("jobName"),
    locationid: Number(read("locationid")) || 0,
    salaryLevelID: read("salaryLevelID"),
  };
}

function countOpen(jobs: Job[] | null): number {
  return (jobs ?? []).filter((job) => job.isOpen).length;
}

function Outage() {
  return (
    <p role="alert" className="text-muted-foreground px-6 py-16 text-center text-sm">
      Ажлын байрын мэдээллийг одоогоор ачаалж чадсангүй. Түр хүлээгээд дахин оролдоно уу.
    </p>
  );
}

export default async function CareersPage({ searchParams }: PageProps<"/careers">) {
  const [jobs, filterData] = await Promise.all([
    loadJobs(toQuery(await searchParams)),
    getFilterData(),
  ]);

  return (
    <main className="flex-1 pt-16">
      <CareersHero roleCount={countOpen(jobs)} />

      <div className="mx-auto w-full max-w-6xl">
        {jobs ? <JobBrowser jobs={jobs} filterData={filterData} /> : <Outage />}
      </div>
    </main>
  );
}
