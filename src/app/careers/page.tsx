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
 * Rendered per request, never cached: a render that hit an outage must not be
 * served to the next visitor. (Awaiting `searchParams` already makes this
 * route dynamic; this states it so a later edit cannot quietly change that.)
 */
export const dynamic = "force-dynamic";

/**
 * The transport's own timeout is 15s, which would hold the whole render that
 * long. The page gives up sooner and shows the outage message instead.
 */
const LOAD_TIMEOUT_MS = 5_000;

/** `promise`, or `null` if it has not settled within `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[careers] gave up after ${ms}ms`);
      resolve(null);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** The postings, or `null` when the backend could not be reached. */
async function loadJobs(query: JobQuery): Promise<Job[] | null> {
  try {
    return await withTimeout(listJobs(query), LOAD_TIMEOUT_MS);
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
    withTimeout(getFilterData(), LOAD_TIMEOUT_MS),
  ]);

  return (
    <main className="flex-1 pt-16">
      <CareersHero />

      <div className="mx-auto w-full max-w-6xl">
        {jobs ? <JobBrowser jobs={jobs} filterData={filterData} /> : <Outage />}
      </div>
    </main>
  );
}
