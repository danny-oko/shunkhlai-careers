export type JobType = "Full-time" | "Part-time" | "Contract" | "Internship";

export type Job = {
  id: string;
  title: string;
  department: string;
  /** Display string, e.g. "Ulaanbaatar, Mongolia". */
  location: string;
  /** Structured location used by the filter tree. "Remote" is its own country. */
  country: string;
  city?: string;
  type: JobType;
  /** Short one-line hook shown under the title in the header. */
  summary: string;
  /** Salary band, already formatted for display. Omitted when undisclosed. */
  salary?: string;
  experience: string;
  postedAt: string;
  aboutRole: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
};

export const jobs: Job[] = [
  {
    id: "account-executive",
    title: "Account Executive",
    department: "Commercial",
    location: "Ulaanbaatar, Mongolia",
    country: "Mongolia",
    city: "Ulaanbaatar",
    type: "Full-time",
    summary:
      "Own the full commercial cycle for our corporate fuel and logistics accounts across Ulaanbaatar.",
    salary: "₮3,500,000 – ₮5,200,000 / month",
    experience: "3+ years",
    postedAt: "2026-08-24",
    aboutRole:
      "As an Account Executive you sit at the front of the Shunkhlai commercial organisation. You will own a portfolio of corporate accounts end to end — from first conversation through contract, onboarding and renewal — and act as the single point of accountability for their experience with us. The role suits someone who is equally comfortable in a mining company's procurement meeting and in a spreadsheet reconciling monthly fuel volumes.",
    responsibilities: [
      "Own a portfolio of 40–60 corporate accounts and carry a quarterly revenue target against it.",
      "Run the full sales cycle: prospecting, discovery, commercial proposal, negotiation and contract signature.",
      "Build multi-threaded relationships across procurement, finance and operations at each account.",
      "Partner with the logistics team to make sure delivery commitments made in the contract are commitments we can keep.",
      "Maintain an accurate pipeline and forecast in the CRM, reviewed weekly with the Commercial Director.",
      "Feed pricing, competitor and market signal back into the commercial team so our offer stays sharp.",
    ],
    requirements: [
      "Bachelor's degree in Business Administration, Economics, Marketing or a related field.",
      "3+ years of B2B sales or key account management experience, ideally in energy, FMCG, logistics or financial services.",
      "Fluent in English and Mongolian, written and spoken.",
      "Demonstrated record of meeting or exceeding a quantitative revenue target.",
      "Strong commercial numeracy — you can build and defend a margin calculation without help.",
      "Valid Mongolian driver's licence (category B) and willingness to travel to client sites within Mongolia.",
    ],
    benefits: [
      "Performance bonus paid quarterly against a transparent, published target.",
      "Private health insurance for you and your immediate family.",
      "Company fuel allowance and mobile package.",
      "Annual professional development budget, including English and certification courses.",
      "25 days of paid annual leave in addition to public holidays.",
      "Hybrid working — three days in our Ulaanbaatar office, two flexible.",
    ],
  },
  {
    id: "financial-analyst",
    title: "Financial Analyst",
    department: "Finance",
    location: "Ulaanbaatar, Mongolia",
    country: "Mongolia",
    city: "Ulaanbaatar",
    type: "Full-time",
    summary:
      "Turn operational data from across the group into the numbers leadership actually plans against.",
    salary: "₮3,000,000 – ₮4,400,000 / month",
    experience: "2+ years",
    postedAt: "2026-08-31",
    aboutRole:
      "Shunkhlai Group runs several businesses with genuinely different economics. This role exists to make them legible to each other. You will own the recurring planning cycle — budget, forecast, month-end variance — and the ad-hoc analysis that shapes investment decisions, working directly with the CFO and the heads of each business unit.",
    responsibilities: [
      "Own the monthly close analysis: variance to budget, commentary, and the pack that goes to leadership.",
      "Build and maintain the rolling 12-month forecast across all business units.",
      "Model the financial case for capital investments and new commercial arrangements.",
      "Partner with business unit leads to translate operational drivers into financial assumptions.",
      "Improve the quality and speed of reporting — automate what is currently manual.",
      "Support the annual audit and statutory reporting cycle.",
    ],
    requirements: [
      "Bachelor's degree in Finance, Accounting, Economics or a related field.",
      "2+ years of experience in financial planning and analysis, audit or corporate banking.",
      "Fluent in English and Mongolian.",
      "Advanced Excel — you are comfortable building a three-statement model from a blank sheet.",
      "Working knowledge of IFRS and Mongolian statutory reporting requirements.",
      "ACCA or CFA progress is an advantage, not a requirement.",
    ],
    benefits: [
      "Full sponsorship for ACCA or CFA, including exam fees and study leave.",
      "Private health insurance for you and your immediate family.",
      "Annual performance bonus.",
      "25 days of paid annual leave in addition to public holidays.",
      "Lunch allowance and a subsidised gym membership.",
      "Hybrid working — three days in our Ulaanbaatar office, two flexible.",
    ],
  },
  {
    id: "product-designer",
    title: "Product Designer",
    department: "Digital",
    location: "Remote",
    country: "Remote",
    type: "Full-time",
    summary:
      "Design the customer-facing digital products behind Mongolia's largest fuel retail network.",
    salary: "₮4,000,000 – ₮6,000,000 / month",
    experience: "4+ years",
    postedAt: "2026-09-02",
    aboutRole:
      "We are building the digital layer on top of a physical network that millions of people already use every week — loyalty, payments, station discovery, fleet management. This is a rare position where design decisions land in the hands of a very large, very non-technical audience almost immediately. You will be the second designer on the team and will have real influence over how the practice is built.",
    responsibilities: [
      "Own end-to-end design for one or more product surfaces, from problem framing through shipped interface.",
      "Run lightweight research with real customers at stations and in fleet offices — not just in the building.",
      "Extend and maintain the shared design system alongside the front-end engineers.",
      "Prototype interactions well enough that engineering never has to guess at intent.",
      "Present work clearly to non-designers and defend the reasoning behind it.",
    ],
    requirements: [
      "4+ years designing digital products, with a portfolio showing shipped work you can talk through in depth.",
      "Fluency in Figma, including components, variables and prototyping.",
      "Fluent in English; Mongolian is a strong advantage.",
      "Experience designing for both iOS and Android alongside responsive web.",
      "Comfort working asynchronously with a distributed team across time zones.",
    ],
    benefits: [
      "Fully remote with an annual travel budget for team gatherings in Ulaanbaatar.",
      "Home office and equipment budget.",
      "Private health insurance.",
      "Annual professional development and conference budget.",
      "25 days of paid annual leave in addition to public holidays.",
    ],
  },
  {
    id: "station-manager",
    title: "Station Manager",
    department: "Retail Operations",
    location: "Ulaanbaatar, Mongolia",
    country: "Mongolia",
    city: "Ulaanbaatar",
    type: "Full-time",
    summary:
      "Run one of our highest-volume fuel stations — the people, the margin and the standard customers judge us by.",
    salary: "₮2,800,000 – ₮4,000,000 / month",
    experience: "3+ years",
    postedAt: "2026-08-18",
    aboutRole:
      "A station is a small business with its own P&L, its own team of twenty and its own queue of customers at seven in the morning. As Station Manager you own all three. This is a hands-on operational role for someone who leads from the forecourt rather than the back office, and who understands that safety and service are the same discipline seen from two angles.",
    responsibilities: [
      "Own the station's daily operation — staffing rota, shift handover, cash reconciliation and stock control.",
      "Lead, train and develop a team of 15–25 attendants and shift supervisors.",
      "Hold the station to Shunkhlai's HSE standard: daily checks, incident reporting and drill readiness.",
      "Manage fuel and convenience stock levels, and place replenishment orders ahead of demand rather than behind it.",
      "Investigate variances between metered volume and sold volume, and escalate anything you cannot explain.",
      "Own the customer experience on site, and resolve escalations personally.",
    ],
    requirements: [
      "Bachelor's degree in Business Administration, Management or a related field.",
      "3+ years of experience managing a retail, hospitality or service site with direct reports.",
      "Fluent in Mongolian; working English.",
      "Sound commercial numeracy — comfortable reading a site P&L and acting on it.",
      "Willingness to work a rotating schedule including weekends and early shifts.",
      "Valid Mongolian driver's licence (category B).",
    ],
    benefits: [
      "Monthly site performance bonus tied to published volume and safety targets.",
      "Private health insurance for you and your immediate family.",
      "Company fuel allowance and mobile package.",
      "Structured progression into Area Manager roles.",
      "20 days of paid annual leave in addition to public holidays.",
      "Meals provided on shift.",
    ],
  },
  {
    id: "logistics-coordinator",
    title: "Logistics Coordinator",
    department: "Logistics",
    location: "Ulaanbaatar, Mongolia",
    country: "Mongolia",
    city: "Ulaanbaatar",
    type: "Full-time",
    summary:
      "Plan and dispatch the tanker fleet that keeps every Shunkhlai station supplied across the country.",
    salary: "₮2,600,000 – ₮3,800,000 / month",
    experience: "2+ years",
    postedAt: "2026-08-27",
    aboutRole:
      "Mongolia is a large country with a short delivery window and long winters. This role sits in the middle of that problem. You will build the daily dispatch plan, keep drivers moving safely, and make the call when weather, border delays or a mechanical failure force the plan to change — which it will, most weeks.",
    responsibilities: [
      "Build and publish the daily and weekly delivery schedule across the tanker fleet.",
      "Dispatch drivers, track journeys in progress and re-plan when conditions change.",
      "Coordinate with station managers on delivery windows so no site runs dry.",
      "Maintain accurate records of trip sheets, fuel volumes, tolls and driver hours.",
      "Track fleet compliance — vehicle inspection, permits, licences and rest periods.",
      "Report on delivery performance and cost per litre delivered, and propose improvements.",
    ],
    requirements: [
      "Bachelor's degree in Logistics, Supply Chain Management, Transport or a related field.",
      "2+ years of experience in transport planning, dispatch or supply chain operations.",
      "Fluent in Mongolian; working English for supplier and border documentation.",
      "Strong Excel skills and comfort working in a TMS or dispatch system.",
      "Working knowledge of Mongolian road transport and dangerous goods regulations.",
      "Calm under pressure — this role involves real-time decisions with incomplete information.",
    ],
    benefits: [
      "Quarterly performance bonus against delivery reliability targets.",
      "Private health insurance for you and your immediate family.",
      "Company mobile package and transport allowance.",
      "Training in dangerous goods handling and transport safety, fully sponsored.",
      "25 days of paid annual leave in addition to public holidays.",
      "Lunch allowance.",
    ],
  },
  {
    id: "hse-officer",
    title: "HSE Officer",
    department: "Health, Safety & Environment",
    location: "Ulaanbaatar, Mongolia",
    country: "Mongolia",
    city: "Ulaanbaatar",
    type: "Full-time",
    summary:
      "Keep our ISO 14001, ISO 9001 and OHSAS 18001 commitments real at every site, not just on the certificate.",
    salary: "₮3,000,000 – ₮4,200,000 / month",
    experience: "3+ years",
    postedAt: "2026-08-21",
    aboutRole:
      "Shunkhlai handles flammable product at scale, across dozens of sites, in a climate that ranges from −40 °C to +35 °C. Our HSE management system is certified — this role exists to make sure it is also true. You will spend most of your week on site rather than at a desk, auditing, training and closing findings with the people who actually do the work.",
    responsibilities: [
      "Audit stations, depots and the transport fleet against our HSE management system.",
      "Investigate incidents and near-misses to root cause, and drive corrective actions to closure.",
      "Deliver practical safety training and toolbox talks to station and driver teams.",
      "Maintain the risk register and update site-level risk assessments as operations change.",
      "Prepare the organisation for external ISO 14001, ISO 9001 and OHSAS 18001 audits.",
      "Track and report HSE performance to the leadership team each month.",
    ],
    requirements: [
      "Bachelor's degree in Occupational Health and Safety, Environmental Science, Engineering or a related field.",
      "3+ years of HSE experience in fuel, mining, construction, manufacturing or heavy transport.",
      "Fluent in English and Mongolian — you will read international standards and train in Mongolian.",
      "Working knowledge of ISO 14001, ISO 9001 and OHSAS 18001 / ISO 45001 requirements.",
      "Familiarity with Mongolian occupational safety and environmental regulation.",
      "Valid Mongolian driver's licence (category B) and willingness to travel to sites across Mongolia.",
    ],
    benefits: [
      "Full sponsorship for NEBOSH, IOSH or lead auditor certification.",
      "Private health insurance for you and your immediate family.",
      "Annual performance bonus.",
      "Company vehicle for site travel.",
      "25 days of paid annual leave in addition to public holidays.",
      "Field allowance for overnight site visits.",
    ],
  },
  {
    id: "backend-engineer",
    title: "Backend Engineer",
    department: "Digital",
    location: "Remote",
    country: "Remote",
    type: "Full-time",
    summary:
      "Build the services behind loyalty, payments and fleet management for millions of transactions a month.",
    salary: "₮5,000,000 – ₮7,500,000 / month",
    experience: "4+ years",
    postedAt: "2026-09-04",
    aboutRole:
      "Our digital platform sits on top of a physical network that never stops running, which makes correctness and uptime real constraints rather than aspirations. You will work on the services that price a transaction, award loyalty points and reconcile against the station's own systems. The team is small, so you will own systems end to end — design, ship, operate.",
    responsibilities: [
      "Design, build and operate backend services for loyalty, payments and fleet management.",
      "Own the reliability of what you ship, including on-call rotation and incident follow-up.",
      "Model and evolve the data layer as the product grows, without breaking what already works.",
      "Build and maintain integrations with payment providers and station point-of-sale systems.",
      "Write the tests and observability that let the team change things safely.",
      "Review code and raise the engineering standard of the team as it grows.",
    ],
    requirements: [
      "4+ years of professional backend engineering experience shipping production systems.",
      "Strong command of at least one of TypeScript, Go or Java, and of relational database design.",
      "Experience operating services in production — deployment, monitoring and debugging live issues.",
      "Fluent in English; Mongolian is a strong advantage.",
      "Experience with payment, financial or other systems where correctness is non-negotiable.",
      "Comfort working asynchronously with a distributed team across time zones.",
    ],
    benefits: [
      "Fully remote with an annual travel budget for team gatherings in Ulaanbaatar.",
      "Home office and equipment budget.",
      "Private health insurance.",
      "Annual professional development and conference budget.",
      "25 days of paid annual leave in addition to public holidays.",
      "On-call compensation, paid separately from base salary.",
    ],
  },
  {
    id: "marketing-intern",
    title: "Marketing Intern",
    department: "Marketing",
    location: "Ulaanbaatar, Mongolia",
    country: "Mongolia",
    city: "Ulaanbaatar",
    type: "Internship",
    summary:
      "A six-month paid internship for a student who wants real campaign work, not coffee runs.",
    experience: "No experience required",
    postedAt: "2026-09-05",
    aboutRole:
      "This is a structured six-month internship in the Shunkhlai marketing team, designed for a final-year student or recent graduate. You will be given genuine ownership of small pieces of live work — a social campaign, a station promotion, a customer survey — with a named mentor and a review at the halfway point. Strong interns are regularly offered permanent roles at the end.",
    responsibilities: [
      "Support the planning and delivery of station promotions and loyalty campaigns.",
      "Draft and schedule social content in Mongolian, and report on how it performed.",
      "Help run customer surveys at stations and summarise what the responses actually say.",
      "Keep the brand asset library organised and consistent with the corporate brandbook.",
      "Prepare campaign performance summaries for the weekly marketing meeting.",
    ],
    requirements: [
      "Final-year student or recent graduate in Marketing, Communications, Business or a related field.",
      "Fluent in Mongolian; working English.",
      "Confident written Mongolian — you will draft copy that customers read.",
      "Comfortable with Excel or Google Sheets, and willing to learn analytics tools.",
      "Available for at least 30 hours per week across the six-month placement.",
    ],
    benefits: [
      "Paid internship with a monthly stipend.",
      "A named mentor and a structured mid-point and end-of-placement review.",
      "Priority consideration for permanent roles at the end of the placement.",
      "Transport and lunch allowance.",
      "Flexible scheduling around university examination periods.",
    ],
  },
];

export function getJobById(id: string): Job | undefined {
  return jobs.find((job) => job.id === id);
}

export function getAllJobIds(): string[] {
  return jobs.map((job) => job.id);
}

/* -------------------------------------------------------------------------
   Filtering
   ---------------------------------------------------------------------- */

/**
 * A single row in a filter list. `depth: 1` rows are children of the country
 * above them and render indented behind an em dash.
 */
export type FilterOption = {
  value: string;
  label: string;
  depth: 0 | 1;
  count: number;
};

export const ALL_LOCATIONS = "all-locations";
export const ALL_DEPARTMENTS = "all-departments";

/**
 * Builds the location tree: every country, each followed by its cities.
 * Countries without a city (Remote) contribute a single row.
 */
export function getLocationOptions(source: Job[] = jobs): FilterOption[] {
  const countries = new Map<string, Map<string, number>>();

  for (const job of source) {
    const cities = countries.get(job.country) ?? new Map<string, number>();
    if (job.city) {
      cities.set(job.city, (cities.get(job.city) ?? 0) + 1);
    }
    countries.set(job.country, cities);
  }

  const options: FilterOption[] = [
    { value: ALL_LOCATIONS, label: "All locations", depth: 0, count: source.length },
  ];

  for (const country of [...countries.keys()].sort((a, b) => a.localeCompare(b))) {
    const cities = countries.get(country)!;
    options.push({
      value: `country:${country}`,
      label: country,
      depth: 0,
      count: source.filter((job) => job.country === country).length,
    });

    for (const city of [...cities.keys()].sort((a, b) => a.localeCompare(b))) {
      options.push({
        value: `city:${city}`,
        label: city,
        depth: 1,
        count: cities.get(city)!,
      });
    }
  }

  return options;
}

export function getDepartmentOptions(source: Job[] = jobs): FilterOption[] {
  const departments = new Map<string, number>();
  for (const job of source) {
    departments.set(job.department, (departments.get(job.department) ?? 0) + 1);
  }

  return [
    { value: ALL_DEPARTMENTS, label: "All departments", depth: 0, count: source.length },
    ...[...departments.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map<FilterOption>((department) => ({
        value: `department:${department}`,
        label: department,
        depth: 0,
        count: departments.get(department)!,
      })),
  ];
}

export function matchesLocation(job: Job, value: string): boolean {
  if (value === ALL_LOCATIONS) return true;
  if (value.startsWith("country:")) return job.country === value.slice(8);
  if (value.startsWith("city:")) return job.city === value.slice(5);
  return true;
}

export function matchesDepartment(job: Job, value: string): boolean {
  if (value === ALL_DEPARTMENTS) return true;
  if (value.startsWith("department:")) return job.department === value.slice(11);
  return true;
}
