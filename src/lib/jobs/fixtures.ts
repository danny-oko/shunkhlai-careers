import type { RecruitmentOrderDto } from "@/lib/api/jobs";

/**
 * Offline job postings, written in the *backend's* shape rather than the UI's.
 *
 * They are served whenever `NEXT_PUBLIC_API_URL` is unset, which means local
 * development runs the same mapper the live API will run — a field the mapper
 * cannot read is a bug that shows up here, not first in production.
 */
export const recruitmentOrderFixtures: RecruitmentOrderDto[] = [
  {
    entryid: 1,
    jobname: "Account Executive",
    depname: "Commercial",
    companyname: "Шунхлай ХХК",
    locationname: "Ulaanbaatar, Mongolia",
    worktypename: "Full-time",
    salary: "₮3,500,000 – ₮5,200,000 / month",
    experience: "3+ years",
    brieftext: "Own the full commercial cycle for our corporate fuel and logistics accounts across Ulaanbaatar.",
    description: "As an Account Executive you sit at the front of the Shunkhlai commercial organisation. You will own a portfolio of corporate accounts end to end — from first conversation through contract, onboarding and renewal — and act as the single point of accountability for their experience with us. The role suits someone who is equally comfortable in a mining company's procurement meeting and in a spreadsheet reconciling monthly fuel volumes.",
    duty: "Own a portfolio of 40–60 corporate accounts and carry a quarterly revenue target against it.\nRun the full sales cycle: prospecting, discovery, commercial proposal, negotiation and contract signature.\nBuild multi-threaded relationships across procurement, finance and operations at each account.\nPartner with the logistics team to make sure delivery commitments made in the contract are commitments we can keep.\nMaintain an accurate pipeline and forecast in the CRM, reviewed weekly with the Commercial Director.\nFeed pricing, competitor and market signal back into the commercial team so our offer stays sharp.",
    requirement: "Bachelor's degree in Business Administration, Economics, Marketing or a related field.\n3+ years of B2B sales or key account management experience, ideally in energy, FMCG, logistics or financial services.\nFluent in English and Mongolian, written and spoken.\nDemonstrated record of meeting or exceeding a quantitative revenue target.\nStrong commercial numeracy — you can build and defend a margin calculation without help.\nValid Mongolian driver's licence (category B) and willingness to travel to client sites within Mongolia.",
    benefit: "Performance bonus paid quarterly against a transparent, published target.\nPrivate health insurance for you and your immediate family.\nCompany fuel allowance and mobile package.\nAnnual professional development budget, including English and certification courses.\n25 days of paid annual leave in addition to public holidays.\nHybrid working — three days in our Ulaanbaatar office, two flexible.",
    regdate: "2026-08-24"
  },
  {
    entryid: 2,
    jobname: "Financial Analyst",
    depname: "Finance",
    companyname: "Шунхлай ХХК",
    locationname: "Ulaanbaatar, Mongolia",
    worktypename: "Full-time",
    salary: "₮3,000,000 – ₮4,400,000 / month",
    experience: "2+ years",
    brieftext: "Turn operational data from across the group into the numbers leadership actually plans against.",
    description: "Shunkhlai Group runs several businesses with genuinely different economics. This role exists to make them legible to each other. You will own the recurring planning cycle — budget, forecast, month-end variance — and the ad-hoc analysis that shapes investment decisions, working directly with the CFO and the heads of each business unit.",
    duty: "Own the monthly close analysis: variance to budget, commentary, and the pack that goes to leadership.\nBuild and maintain the rolling 12-month forecast across all business units.\nModel the financial case for capital investments and new commercial arrangements.\nPartner with business unit leads to translate operational drivers into financial assumptions.\nImprove the quality and speed of reporting — automate what is currently manual.\nSupport the annual audit and statutory reporting cycle.",
    requirement: "Bachelor's degree in Finance, Accounting, Economics or a related field.\n2+ years of experience in financial planning and analysis, audit or corporate banking.\nFluent in English and Mongolian.\nAdvanced Excel — you are comfortable building a three-statement model from a blank sheet.\nWorking knowledge of IFRS and Mongolian statutory reporting requirements.\nACCA or CFA progress is an advantage, not a requirement.",
    benefit: "Full sponsorship for ACCA or CFA, including exam fees and study leave.\nPrivate health insurance for you and your immediate family.\nAnnual performance bonus.\n25 days of paid annual leave in addition to public holidays.\nLunch allowance and a subsidised gym membership.\nHybrid working — three days in our Ulaanbaatar office, two flexible.",
    regdate: "2026-08-31"
  },
  {
    entryid: 3,
    jobname: "Product Designer",
    depname: "Digital",
    companyname: "Шунхлай ХХК",
    locationname: "Remote",
    worktypename: "Full-time",
    salary: "₮4,000,000 – ₮6,000,000 / month",
    experience: "4+ years",
    brieftext: "Design the customer-facing digital products behind Mongolia's largest fuel retail network.",
    description: "We are building the digital layer on top of a physical network that millions of people already use every week — loyalty, payments, station discovery, fleet management. This is a rare position where design decisions land in the hands of a very large, very non-technical audience almost immediately. You will be the second designer on the team and will have real influence over how the practice is built.",
    duty: "Own end-to-end design for one or more product surfaces, from problem framing through shipped interface.\nRun lightweight research with real customers at stations and in fleet offices — not just in the building.\nExtend and maintain the shared design system alongside the front-end engineers.\nPrototype interactions well enough that engineering never has to guess at intent.\nPresent work clearly to non-designers and defend the reasoning behind it.",
    requirement: "4+ years designing digital products, with a portfolio showing shipped work you can talk through in depth.\nFluency in Figma, including components, variables and prototyping.\nFluent in English; Mongolian is a strong advantage.\nExperience designing for both iOS and Android alongside responsive web.\nComfort working asynchronously with a distributed team across time zones.",
    benefit: "Fully remote with an annual travel budget for team gatherings in Ulaanbaatar.\nHome office and equipment budget.\nPrivate health insurance.\nAnnual professional development and conference budget.\n25 days of paid annual leave in addition to public holidays.",
    regdate: "2026-09-02"
  },
  {
    entryid: 4,
    jobname: "Station Manager",
    depname: "Retail Operations",
    companyname: "Шунхлай ХХК",
    locationname: "Ulaanbaatar, Mongolia",
    worktypename: "Full-time",
    salary: "₮2,800,000 – ₮4,000,000 / month",
    experience: "3+ years",
    brieftext: "Run one of our highest-volume fuel stations — the people, the margin and the standard customers judge us by.",
    description: "A station is a small business with its own P&L, its own team of twenty and its own queue of customers at seven in the morning. As Station Manager you own all three. This is a hands-on operational role for someone who leads from the forecourt rather than the back office, and who understands that safety and service are the same discipline seen from two angles.",
    duty: "Own the station's daily operation — staffing rota, shift handover, cash reconciliation and stock control.\nLead, train and develop a team of 15–25 attendants and shift supervisors.\nHold the station to Shunkhlai's HSE standard: daily checks, incident reporting and drill readiness.\nManage fuel and convenience stock levels, and place replenishment orders ahead of demand rather than behind it.\nInvestigate variances between metered volume and sold volume, and escalate anything you cannot explain.\nOwn the customer experience on site, and resolve escalations personally.",
    requirement: "Bachelor's degree in Business Administration, Management or a related field.\n3+ years of experience managing a retail, hospitality or service site with direct reports.\nFluent in Mongolian; working English.\nSound commercial numeracy — comfortable reading a site P&L and acting on it.\nWillingness to work a rotating schedule including weekends and early shifts.\nValid Mongolian driver's licence (category B).",
    benefit: "Monthly site performance bonus tied to published volume and safety targets.\nPrivate health insurance for you and your immediate family.\nCompany fuel allowance and mobile package.\nStructured progression into Area Manager roles.\n20 days of paid annual leave in addition to public holidays.\nMeals provided on shift.",
    regdate: "2026-08-18"
  },
  {
    entryid: 5,
    jobname: "Logistics Coordinator",
    depname: "Logistics",
    companyname: "Шунхлай ХХК",
    locationname: "Ulaanbaatar, Mongolia",
    worktypename: "Full-time",
    salary: "₮2,600,000 – ₮3,800,000 / month",
    experience: "2+ years",
    brieftext: "Plan and dispatch the tanker fleet that keeps every Shunkhlai station supplied across the country.",
    description: "Mongolia is a large country with a short delivery window and long winters. This role sits in the middle of that problem. You will build the daily dispatch plan, keep drivers moving safely, and make the call when weather, border delays or a mechanical failure force the plan to change — which it will, most weeks.",
    duty: "Build and publish the daily and weekly delivery schedule across the tanker fleet.\nDispatch drivers, track journeys in progress and re-plan when conditions change.\nCoordinate with station managers on delivery windows so no site runs dry.\nMaintain accurate records of trip sheets, fuel volumes, tolls and driver hours.\nTrack fleet compliance — vehicle inspection, permits, licences and rest periods.\nReport on delivery performance and cost per litre delivered, and propose improvements.",
    requirement: "Bachelor's degree in Logistics, Supply Chain Management, Transport or a related field.\n2+ years of experience in transport planning, dispatch or supply chain operations.\nFluent in Mongolian; working English for supplier and border documentation.\nStrong Excel skills and comfort working in a TMS or dispatch system.\nWorking knowledge of Mongolian road transport and dangerous goods regulations.\nCalm under pressure — this role involves real-time decisions with incomplete information.",
    benefit: "Quarterly performance bonus against delivery reliability targets.\nPrivate health insurance for you and your immediate family.\nCompany mobile package and transport allowance.\nTraining in dangerous goods handling and transport safety, fully sponsored.\n25 days of paid annual leave in addition to public holidays.\nLunch allowance.",
    regdate: "2026-08-27"
  },
  {
    entryid: 6,
    jobname: "HSE Officer",
    depname: "Health, Safety & Environment",
    companyname: "Шунхлай ХХК",
    locationname: "Ulaanbaatar, Mongolia",
    worktypename: "Full-time",
    salary: "₮3,000,000 – ₮4,200,000 / month",
    experience: "3+ years",
    brieftext: "Keep our ISO 14001, ISO 9001 and OHSAS 18001 commitments real at every site, not just on the certificate.",
    description: "Shunkhlai handles flammable product at scale, across dozens of sites, in a climate that ranges from −40 °C to +35 °C. Our HSE management system is certified — this role exists to make sure it is also true. You will spend most of your week on site rather than at a desk, auditing, training and closing findings with the people who actually do the work.",
    duty: "Audit stations, depots and the transport fleet against our HSE management system.\nInvestigate incidents and near-misses to root cause, and drive corrective actions to closure.\nDeliver practical safety training and toolbox talks to station and driver teams.\nMaintain the risk register and update site-level risk assessments as operations change.\nPrepare the organisation for external ISO 14001, ISO 9001 and OHSAS 18001 audits.\nTrack and report HSE performance to the leadership team each month.",
    requirement: "Bachelor's degree in Occupational Health and Safety, Environmental Science, Engineering or a related field.\n3+ years of HSE experience in fuel, mining, construction, manufacturing or heavy transport.\nFluent in English and Mongolian — you will read international standards and train in Mongolian.\nWorking knowledge of ISO 14001, ISO 9001 and OHSAS 18001 / ISO 45001 requirements.\nFamiliarity with Mongolian occupational safety and environmental regulation.\nValid Mongolian driver's licence (category B) and willingness to travel to sites across Mongolia.",
    benefit: "Full sponsorship for NEBOSH, IOSH or lead auditor certification.\nPrivate health insurance for you and your immediate family.\nAnnual performance bonus.\nCompany vehicle for site travel.\n25 days of paid annual leave in addition to public holidays.\nField allowance for overnight site visits.",
    regdate: "2026-08-21"
  },
  {
    entryid: 7,
    jobname: "Backend Engineer",
    depname: "Digital",
    companyname: "Шунхлай ХХК",
    locationname: "Remote",
    worktypename: "Full-time",
    salary: "₮5,000,000 – ₮7,500,000 / month",
    experience: "4+ years",
    brieftext: "Build the services behind loyalty, payments and fleet management for millions of transactions a month.",
    description: "Our digital platform sits on top of a physical network that never stops running, which makes correctness and uptime real constraints rather than aspirations. You will work on the services that price a transaction, award loyalty points and reconcile against the station's own systems. The team is small, so you will own systems end to end — design, ship, operate.",
    duty: "Design, build and operate backend services for loyalty, payments and fleet management.\nOwn the reliability of what you ship, including on-call rotation and incident follow-up.\nModel and evolve the data layer as the product grows, without breaking what already works.\nBuild and maintain integrations with payment providers and station point-of-sale systems.\nWrite the tests and observability that let the team change things safely.\nReview code and raise the engineering standard of the team as it grows.",
    requirement: "4+ years of professional backend engineering experience shipping production systems.\nStrong command of at least one of TypeScript, Go or Java, and of relational database design.\nExperience operating services in production — deployment, monitoring and debugging live issues.\nFluent in English; Mongolian is a strong advantage.\nExperience with payment, financial or other systems where correctness is non-negotiable.\nComfort working asynchronously with a distributed team across time zones.",
    benefit: "Fully remote with an annual travel budget for team gatherings in Ulaanbaatar.\nHome office and equipment budget.\nPrivate health insurance.\nAnnual professional development and conference budget.\n25 days of paid annual leave in addition to public holidays.\nOn-call compensation, paid separately from base salary.",
    regdate: "2026-09-04"
  },
  {
    entryid: 8,
    jobname: "Marketing Intern",
    depname: "Marketing",
    companyname: "Шунхлай ХХК",
    locationname: "Ulaanbaatar, Mongolia",
    worktypename: "Internship",
    experience: "No experience required",
    brieftext: "A six-month paid internship for a student who wants real campaign work, not coffee runs.",
    description: "This is a structured six-month internship in the Shunkhlai marketing team, designed for a final-year student or recent graduate. You will be given genuine ownership of small pieces of live work — a social campaign, a station promotion, a customer survey — with a named mentor and a review at the halfway point. Strong interns are regularly offered permanent roles at the end.",
    duty: "Support the planning and delivery of station promotions and loyalty campaigns.\nDraft and schedule social content in Mongolian, and report on how it performed.\nHelp run customer surveys at stations and summarise what the responses actually say.\nKeep the brand asset library organised and consistent with the corporate brandbook.\nPrepare campaign performance summaries for the weekly marketing meeting.",
    requirement: "Final-year student or recent graduate in Marketing, Communications, Business or a related field.\nFluent in Mongolian; working English.\nConfident written Mongolian — you will draft copy that customers read.\nComfortable with Excel or Google Sheets, and willing to learn analytics tools.\nAvailable for at least 30 hours per week across the six-month placement.",
    benefit: "Paid internship with a monthly stipend.\nA named mentor and a structured mid-point and end-of-placement review.\nPriority consideration for permanent roles at the end of the placement.\nTransport and lunch allowance.\nFlexible scheduling around university examination periods.",
    regdate: "2026-09-05"
  }
];
