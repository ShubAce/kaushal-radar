// Shapes of the JSON artefacts written by pipeline/run.py, and of the rows the
// data layer derives from them.

export type ClassKey = "saturated" | "surplus" | "balanced" | "shortage" | "acute_shortage";
export type Severity = "critical" | "warning" | "watch";
export type Locale = "en" | "hi" | "mr" | "ta" | "gu";

export interface Meta {
  product: string;
  /** true when the labour-market sources were generated; false when they were read from input files */
  demo: boolean;
  /** input files read by the pipeline run (empty for the demo) */
  inputs: string[];
  generatedAt: string;
  dataAsOf: string;
  months: string[];
  histLen: number;
  fcLen: number;
  planFY: string;
  planMonths: [string, string];
  counts: {
    states: number; districts: number; sectors: number; trades: number; cells: number;
    acute: number; shortage: number; balanced: number; surplus: number; saturated: number;
    flags: number; critical: number; warning: number; projects: number; records: number;
  };
  totals: {
    demandNow: number; supplyNow: number; demandNext: number; supplyNext: number;
    seatsNow: number; seatsDraft: number; movable: number; wa: number; pop: number;
  };
  plan: Record<string, { draft: number; rec: number; up: number; down: number; rows: number }>;
}

export interface StateInfo { id: string; name: string; lang: Locale; districts: number; pop: number; wa: number }
export interface DistrictInfo { id: string; name: string; state: string; pop: number; wa: number; urban: number; basis: string }
export interface Geo { states: StateInfo[]; districts: DistrictInfo[] }

export interface Sector { id: string; name: string; hi: string; ssc: string }
export interface Trade {
  id: string; name: string; hi: string; sector: string; nco: string; ncoTitle: string; nsqf: number;
  kind: "STT" | "ITI"; months: number; qp: string | null; emerging: boolean; yield_: number; base: number;
}
export interface Taxonomy { sectors: Sector[]; trades: Trade[]; classes: ClassKey[] }

/** Demand and supply now (last 12 months) and in the planning year, with scores. */
export interface Balance {
  dn: number; sn: number; dx: number; sx: number; lo: number; hi: number; s0: number; s1: number;
}
export interface CellRow extends Balance {
  district: string; trade: string; cdi: number; mom: number; conf: number; act: number; rob: number;
  seats: number; draft: number; plc: number; up: number;
}
export interface TradeRow extends Balance {
  trade: string; cdi: number; mom: number; realloc: number; growth?: number; broke?: number;
}
export interface GroupRow extends Balance { id: string; mi: number }

export interface Series { d: number[]; s: number[]; lo: number[]; hi: number[] }
export interface SeriesFile {
  trades: Record<string, Series>;
  sectors: Record<string, Series>;
  all: Series;
  detail?: Record<string, CellDetail>;
}
export interface CellDetail {
  src: Record<string, number>; raw: Record<string, number>; w: Record<string, number>;
  seats: Record<string, number>; enrolled: number; certified: number; entrants: number; eshram: number;
}

export interface Flag {
  id: string; level: "district" | "state"; geo: string; trade: string;
  type: "emerging_shortage" | "deepening_shortage" | "approaching_saturation" | "deepening_saturation"
    | "demand_accelerating" | "demand_slowing";
  severity: Severity; lead: number; month: string; from_class: ClassKey; to_class: ClassKey;
  score_now: number; score_next: number; d_now: number; s_now: number; d_next: number; s_next: number;
  gap: number; likelihood: number; conf: number; project_share: number; priority: number; accel?: number;
}

export type PlanReason =
  | "hold" | "hold_small" | "cut_saturated" | "cut_surplus" | "cut_capped"
  | "raise_acute" | "raise_shortage" | "raise_capped" | "new_course";
export interface PlanRow {
  district: string; trade: string; draft: number; need: number; rec: number; conv: number;
  demand: number; reason: PlanReason; conf: number; score: number;
}

export interface Project {
  id: string; district: string; state: string; month: string; title: string; sector: string;
  jobs: Record<string, number>; total: number; p: number;
}

export interface MapShape { id: string; name: string; d: string; c: [number, number]; box: [number, number, number, number]; pilot?: boolean }
export interface MapIndia { w: number; h: number; states: MapShape[] }
export interface MapState { state: string; box: [number, number, number, number]; districts: MapShape[] }

export interface SourceMeta {
  id: string; name: string; standsFor: string; freq: string; lagMonths: number; records: number;
  coverage: { mean: number; min: number; max: number };
  coverageByTrade: Record<string, number>;
  noise: Record<string, number>; weight: Record<string, number>; tilt: Record<string, number>;
}
type Wape = Record<"district" | "state" | "national", Record<string, number>>;
export interface Method {
  sources: SourceMeta[];
  /** only for simulated data, where the hidden truth is known */
  recovery: {
    fy: number; cells: number;
    index: { wape: number; corr: number };
    portalOnly: { wape: number; corr: number };
    simpleAverage: { wape: number; corr: number };
  } | null;
  backtest: {
    origins: string[]; horizons: number[]; naive: Wape; model: Wape;
    byGroup: Record<"fast" | "stable", Record<string, { naive: number; model: number }>>;
    leadTest: { without: number; with_signal: number; flags: number } | null;
    bands: { sizeEdges: number[]; district: number[][][]; state: number[][]; national: number[][] };
  };
  placementCheck: { spearman: number; cells: number; fy: number } | null;
  quality: {
    ncsSpikesDamped: number; benchmarkYears: number[]; portalRawPostings: number | null;
    portalDuplicateRate: number | null; payrollLagMonths: number;
  };
  params: {
    shrinkK: number; scoreK: number; classCuts: [number, number]; planMaxUp: number; planMaxDown: number;
    planBand: number; funnel: Record<string, { util: number; complete: number; certify: number; entry: number }>;
  };
  trendBreaks: number;
}
