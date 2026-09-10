import type { RecruitmentOrderDto } from "@/lib/api/jobs";

import type { Job, JobType } from "./types";

/**
 * The only place that knows the recruitment API's field names.
 *
 * The endpoint reference documents request bodies but not responses, so the
 * readers below accept the handful of spellings a posting might arrive under.
 * When a real response is available: check it against these keys, delete the
 * alternatives that turn out to be wrong, and nothing else in the app moves.
 */

function readString(dto: RecruitmentOrderDto, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = dto[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

/**
 * Long text arrives as one blob. Postings are authored as lists, so split on
 * the separators an author or a rich-text editor produces and drop the noise.
 */
function readList(dto: RecruitmentOrderDto, ...keys: string[]): string[] {
  const blob = readString(dto, ...keys);
  if (!blob) return [];

  return blob
    .replace(/<\/(?:li|p|div|br)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n|(?:^|\s)[•·▪]\s*/)
    .map((line) => line.replace(/^\s*[-–—*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

const WORK_TYPES: Record<string, JobType> = {
  "full-time": "Full-time",
  fulltime: "Full-time",
  ftime: "Full-time",
  "part-time": "Part-time",
  parttime: "Part-time",
  ptime: "Part-time",
  contract: "Contract",
  internship: "Internship",
  intern: "Internship",
};

function readJobType(dto: RecruitmentOrderDto): JobType {
  const raw = readString(dto, "worktypename", "worktype");
  if (!raw) return "Full-time";
  return WORK_TYPES[raw.toLowerCase().replace(/\s+/g, "-")] ?? "Full-time";
}

/**
 * Locations come back as one display string. "Ulaanbaatar, Mongolia" splits
 * into city + country for the filter tree; a single-part value ("Remote") is
 * treated as its own country, which is how the filter already models it.
 */
function readLocation(dto: RecruitmentOrderDto): Pick<Job, "location" | "country" | "city"> {
  const location = readString(dto, "locationname", "location", "aimagname") ?? "Mongolia";
  const explicitCountry = readString(dto, "countryname");

  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      location,
      country: explicitCountry ?? parts[parts.length - 1],
      city: parts[0],
    };
  }

  return { location, country: explicitCountry ?? location };
}

export function toSlug(id: string, title: string): string {
  const readable = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return readable ? `${id}-${readable}` : id;
}

/** Pulls the numeric id back out of a slug produced by `toSlug`. */
export function parseJobId(slug: string): string | null {
  const match = /^(\d+)(?:-|$)/.exec(slug);
  return match ? match[1] : null;
}

export function toJob(dto: RecruitmentOrderDto): Job | null {
  const id = readString(dto, "entryID", "entryid", "id", "recruitmentorderid");
  const title = readString(dto, "jobname", "jobName", "positionname", "title");

  // A posting with no id or no title cannot be linked to or listed; skipping
  // it beats rendering a broken card.
  if (!id || !title) return null;

  return {
    id,
    slug: toSlug(id, title),
    title,
    department:
      readString(dto, "depname", "departmentname", "posgroupname", "companyname") ?? "Shunkhlai",
    ...readLocation(dto),
    type: readJobType(dto),
    summary: readString(dto, "brieftext", "summary") ?? "",
    salary: readString(dto, "salary", "salarylevelname"),
    experience: readString(dto, "experience", "expyear") ?? "—",
    postedAt: readString(dto, "regdate", "begindate", "created") ?? "",
    aboutRole: readString(dto, "description", "jobdescription") ?? "",
    responsibilities: readList(dto, "duty", "responsibility", "dutytext"),
    requirements: readList(dto, "requirement", "requirementtext", "condition"),
    benefits: readList(dto, "benefit", "benefittext", "advantage"),
  };
}

export function toJobs(dtos: RecruitmentOrderDto[]): Job[] {
  return dtos.map(toJob).filter((job): job is Job => job !== null);
}
