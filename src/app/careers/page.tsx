import { CareersHero } from "@/components/brand/careers-hero";
import { BrandValues } from "@/components/brand/brand-values";
import { JobBrowser } from "@/components/job-browser";
import { jobs } from "@/lib/mock-jobs";

export const metadata = {
  title: "Open roles",
  description: "Every role currently open across Shunkhlai Group.",
};

export default function CareersPage() {
  return (
    <main className="flex-1">
      <CareersHero roleCount={jobs.length} />

      <div className="mx-auto w-full max-w-6xl">
        <JobBrowser jobs={jobs} />
      </div>

      <BrandValues />

      <footer className="border-t border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Shunkhlai Group LLC · Ulaanbaatar,
            Mongolia
          </p>
        </div>
      </footer>
    </main>
  );
}
