import { JobBrowser } from "@/components/job-browser";
import { jobs } from "@/lib/mock-jobs";

export const metadata = {
  title: "Open roles",
  description: "Every role currently open across Shunkhlai Group.",
};

export default function CareersPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-0">
      <header className="px-6 pt-20 pb-14 sm:pt-28 sm:pb-16 lg:px-10">
        <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Shunkhlai Group
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
          Open positions at Shunkhlai
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
          We build the energy, logistics and digital infrastructure Mongolia runs
          on. {jobs.length} roles are open right now.
        </p>
      </header>

      <JobBrowser jobs={jobs} />

      <footer className="px-6 py-14 lg:px-10">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Shunkhlai Group LLC · Ulaanbaatar, Mongolia
        </p>
      </footer>
    </main>
  );
}
