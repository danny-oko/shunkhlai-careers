import { CareersHero } from "@/components/brand/careers-hero";
import { BrandValues } from "@/components/brand/brand-values";
import { JobBrowser } from "@/components/job-browser";
import { ThemeToggle } from "@/components/theme-toggle";
import { jobs } from "@/lib/mock-jobs";

export const metadata = {
  title: "Open roles",
  description: "Every role currently open across Shunkhlai Group.",
};

export default function CareersPage() {
  return (
    <main className="flex-1">
      <div className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
          <span className="text-sm font-medium tracking-[-0.01em]">
            Shunkhlai Careers
          </span>
          <ThemeToggle />
        </div>
      </div>

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
