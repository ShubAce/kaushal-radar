// What every input is, whether it is real in this demo, and how the real feed
// would arrive in production. Kept in English: these are proper names.

export type SourceStatus = "real" | "synthetic" | "illustrative" | "supplied";

export interface SourceInfo {
  name: string;
  role: string;
  status: SourceStatus;
  grain: string;
  refresh: string;
  access: string;
  /** input file that replaces the simulated version when the pipeline runs on supplied data */
  file?: string;
}

export const REGISTRY: SourceInfo[] = [
  {
    name: "District and state boundaries", role: "Map geometry and the district list", status: "real",
    grain: "181 districts in 4 states", refresh: "When boundaries change",
    access: "Open boundary file (2011 census districts with later splits). Production key: Local Government Directory codes.",
  },
  {
    name: "District population", role: "Per-person rates and working-age base", status: "real",
    grain: "District", refresh: "Decennial; projected between censuses",
    access: "Census 2011, scaled to 2026 by state growth. Newer districts are apportioned from their parent.",
  },
  {
    name: "Occupation and qualification codes", role: "Common language across sources", status: "real",
    grain: "NCO-2015 four-digit family, NSQF level", refresh: "When NCVET revises qualifications",
    access: "NCO-2015 (Ministry of Labour) and the National Qualifications Register. Qualification-pack codes are shown only where mapped.",
  },
  {
    name: "Online job postings", role: "Demand signal: most timely, urban and white-collar tilt", status: "synthetic",
    grain: "District × occupation, daily", refresh: "Daily",
    access: "API partnerships with job portals; postings de-duplicated and coded to NCO by the job-ad mapper.",
    file: "demand_signals.csv",
  },
  {
    name: "NCS vacancies", role: "Demand signal: public employment service", status: "synthetic",
    grain: "District × occupation, daily", refresh: "Daily",
    access: "National Career Service, Ministry of Labour and Employment, by inter-ministry data sharing.",
    file: "demand_signals.csv",
  },
  {
    name: "Formal payroll additions", role: "Demand signal: least noisy, formal jobs only", status: "synthetic",
    grain: "Establishment district × industry, monthly", refresh: "Monthly, two months late",
    access: "EPFO and ESIC payroll records, aggregated; industry mapped to occupation with survey shares.",
    file: "demand_signals.csv",
  },
  {
    name: "Apprenticeship and employer demand", role: "Demand signal: manufacturing and ITI trades", status: "synthetic",
    grain: "District × trade", refresh: "Daily",
    access: "Apprenticeship openings and employer demand on Skill India Digital Hub (already inside MSDE).",
    file: "demand_signals.csv",
  },
  {
    name: "Labour force survey benchmark", role: "Calibrates how much of the market each source sees", status: "synthetic",
    grain: "State × occupation yearly; district × sector since the 2025 redesign", refresh: "Annual",
    access: "PLFS unit-level data, published by MoSPI.",
    file: "survey_benchmark.csv",
  },
  {
    name: "Training seats and funnel", role: "Supply: seats, enrolment, certification", status: "synthetic",
    grain: "Centre × trade, monthly", refresh: "Monthly",
    access: "Skill India Digital Hub (PMKVY and state missions) and NCVT MIS for ITI seats (inside MSDE and DGT).",
    file: "training_funnel.csv",
  },
  {
    name: "Placement outcomes", role: "Checks the index against what happened to trainees", status: "synthetic",
    grain: "District × trade, by cohort", refresh: "Quarterly",
    access: "Post-certification tracking on Skill India Digital Hub.",
    file: "placement.csv",
  },
  {
    name: "e-Shram registrations", role: "Stock of informal workers by occupation: context for prior-learning certification, not demand", status: "synthetic",
    grain: "District × occupation", refresh: "Monthly",
    access: "e-Shram data-sharing portal, Ministry of Labour and Employment.",
    file: "eshram.csv",
  },
  {
    name: "New enterprise registrations", role: "Candidate lead signal: tested, raised error, not used", status: "synthetic",
    grain: "District × sector, monthly", refresh: "Monthly",
    access: "Udyam and GST registrations.",
    file: "enterprise_registrations.csv",
  },
  {
    name: "Investment pipeline", role: "Expected hiring from announced projects", status: "illustrative",
    grain: "Project: district, month, jobs by trade", refresh: "As announced",
    access: "Modelled on public programmes (for example PM MITRA textile parks). Job numbers, dates and probabilities are assumptions.",
  },
];

export interface SchemaFile { file: string; purpose: string; columns: [string, string][]; optional?: boolean }

/** Input files read by `python pipeline/run.py --inputs <folder>` (see pipeline/inputs.py). */
export const SCHEMAS: SchemaFile[] = [
  {
    file: "demand_signals.csv", purpose: "One row per source, district, trade and month",
    columns: [["source", "portal | ncs | payroll | naps"], ["district_id", "e.g. mh-pune"], ["trade_id", "e.g. ems-operator"], ["month", "YYYY-MM"], ["count", "records observed"]],
  },
  {
    file: "survey_benchmark.csv", purpose: "Annual openings from the labour force survey",
    columns: [["state", "MH | TN | UP | GJ"], ["trade_id", ""], ["fiscal_year", "ending year, e.g. 2026"], ["openings", ""]],
  },
  {
    file: "survey_district.csv", purpose: "District-level survey anchor, by sector", optional: true,
    columns: [["district_id", ""], ["sector_id", "e.g. ELEC"], ["fiscal_year", ""], ["openings", ""]],
  },
  {
    file: "seats.csv", purpose: "Sanctioned seats",
    columns: [["district_id", ""], ["trade_id", ""], ["fiscal_year", ""], ["seats", ""]],
  },
  {
    file: "training_funnel.csv", purpose: "Monthly training pipeline",
    columns: [["district_id", ""], ["trade_id", ""], ["month", "YYYY-MM"], ["enrolled", ""], ["certified", ""], ["entrants", "certified and seeking work"]],
  },
  {
    file: "placement.csv", purpose: "Placement rate of the latest full cohort", optional: true,
    columns: [["district_id", ""], ["trade_id", ""], ["placement_rate", "0 to 1"]],
  },
  {
    file: "eshram.csv", purpose: "Registered informal workers by occupation", optional: true,
    columns: [["district_id", ""], ["trade_id", ""], ["registered", "workers"]],
  },
  {
    file: "enterprise_registrations.csv", purpose: "New enterprises, for the lead-signal test", optional: true,
    columns: [["district_id", ""], ["sector_id", ""], ["month", "YYYY-MM"], ["registrations", ""]],
  },
];
