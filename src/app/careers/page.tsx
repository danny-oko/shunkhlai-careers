import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { jobs } from "@/lib/mock-jobs";

export const metadata = {
  title: "Open roles",
  description: "Every role currently open across Shunkhlai Group.",
};

export default function CareersPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6">
      <header className="pt-20 pb-14 sm:pt-28 sm:pb-16">
        <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Shunkhlai Group
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
          Open roles
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
          We build the energy, logistics and digital infrastructure Mongolia runs
          on. {jobs.length} roles are open right now.
        </p>
      </header>

      <ul className="border-t border-border/70">
        {jobs.map((job) => (
          <li key={job.id} className="border-b border-border/70">
            <Link
              href={`/careers/${job.id}`}
              className="group flex flex-col gap-2 py-7 transition-opacity sm:flex-row sm:items-center sm:justify-between sm:gap-8"
            >
              <div className="min-w-0">
                <h2 className="flex items-center gap-1.5 text-lg font-medium tracking-[-0.02em]">
                  {job.title}
                  <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </h2>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
                  {job.summary}
                </p>
              </div>
              <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
                <p>{job.location}</p>
                <p className="mt-1">
                  {job.department} · {job.type}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="py-14">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Shunkhlai Group LLC · Ulaanbaatar, Mongolia
        </p>
      </footer>
    </main>
  );
}
