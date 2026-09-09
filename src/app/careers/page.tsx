import { CareersHero } from "@/components/brand/careers-hero";
import { JobBrowser } from "@/components/job-browser";
import { jobs } from "@/lib/mock-jobs";

export const metadata = {
  title: "Нээлттэй ажлын байр",
  description: "Шунхлай ХХК-д одоо нээлттэй байгаа бүх ажлын байр.",
};

export default function CareersPage() {
  return (
    <main className="flex-1 pt-16">
      <CareersHero roleCount={jobs.length} />

      <div className="mx-auto w-full max-w-6xl">
        <JobBrowser jobs={jobs} />
      </div>
    </main>
  );
}
