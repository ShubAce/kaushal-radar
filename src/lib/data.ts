// Server-side access to the pipeline's JSON artefacts. Pages and API routes
// both go through here, so the dashboard and the public API can never disagree.
import fs from "node:fs";
import path from "node:path";
import type {
  Balance, CellRow, Flag, Geo, GroupRow, MapIndia, MapState, Meta, Method, PlanRow, Project,
  SeriesFile, Taxonomy, TradeRow,
} from "./types";

// KR_DATA_DIR points the app at another pipeline output folder (it must also hold geo/).
const DIR = process.env.KR_DATA_DIR ? path.resolve(process.env.KR_DATA_DIR) : path.join(process.cwd(), "data");
const cache = new Map<string, unknown>();

function load<T>(rel: string): T {
  let v = cache.get(rel);
  if (v === undefined) {
    v = JSON.parse(fs.readFileSync(path.join(DIR, rel), "utf8"));
    cache.set(rel, v);
  }
  return v as T;
}

type Col = Record<string, number[]>;
interface AggFile {
  stateTrade: Col; nationTrade: Col; districtSector: Col; districtAll: Col;
  stateSector: Col; stateAll: Col; nationSector: Col; nationAll: Col;
}

export const meta = () => load<Meta>("meta.json");
export const geo = () => load<Geo>("geo.json");
export const taxonomy = () => load<Taxonomy>("taxonomy.json");
export const method = () => load<Method>("method.json");
export const mapIndia = () => load<MapIndia>("geo/india.json");
export const mapState = (code: string) => load<MapState>(`geo/${code}.json`);
const cellsRaw = () => load<Col>("cells.json");
const agg = () => load<AggFile>("agg.json");

interface Lookups {
  d: Map<string, number>; o: Map<string, number>; g: Map<string, number>; s: Map<string, number>;
  byState: Map<string, number[]>; bySector: Map<string, number[]>;
}
let lk: Lookups | undefined;
function lookups(): Lookups {
  if (lk) return lk;
  const { states, districts } = geo();
  const { sectors, trades } = taxonomy();
  const byState = new Map<string, number[]>(states.map((s) => [s.id, []]));
  districts.forEach((d, i) => byState.get(d.state)!.push(i));
  const bySector = new Map<string, number[]>(sectors.map((s) => [s.id, []]));
  trades.forEach((t, i) => bySector.get(t.sector)!.push(i));
  lk = {
    d: new Map(districts.map((x, i) => [x.id, i])),
    o: new Map(trades.map((x, i) => [x.id, i])),
    g: new Map(states.map((x, i) => [x.id, i])),
    s: new Map(sectors.map((x, i) => [x.id, i])),
    byState, bySector,
  };
  return lk;
}

export const isState = (id?: string | null): id is string => !!id && lookups().g.has(id);
export const isDistrict = (id?: string | null): id is string => !!id && lookups().d.has(id);
export const isTrade = (id?: string | null): id is string => !!id && lookups().o.has(id);
export const isSector = (id?: string | null): id is string => !!id && lookups().s.has(id);

const KEYS = ["dn", "sn", "dx", "sx", "lo", "hi", "s0", "s1"] as const;
function balance(col: Col, i: number): Balance {
  const out = {} as Balance;
  for (const k of KEYS) out[k] = col[k][i];
  return out;
}

function cellAt(di: number, oi: number): CellRow {
  const c = cellsRaw();
  const { districts } = geo();
  const { trades } = taxonomy();
  const i = di * trades.length + oi;
  return {
    district: districts[di].id, trade: trades[oi].id, ...balance(c, i),
    cdi: c.cdi[i], mom: c.mom[i], conf: c.conf[i], act: c.act[i], rob: c.rob[i],
    seats: c.seats[i], draft: c.draft[i], plc: c.plc[i], up: c.up[i],
  };
}

export interface CellFilter { state?: string; district?: string; sector?: string; trade?: string; all?: boolean }

/** District x trade rows. Inactive cells (almost no demand and no supply) are dropped unless `all`. */
export function cells(f: CellFilter = {}): CellRow[] {
  const L = lookups();
  const { districts } = geo();
  const { trades } = taxonomy();
  const dIdx = f.district ? [L.d.get(f.district)!] : f.state ? L.byState.get(f.state)! : districts.map((_, i) => i);
  const oIdx = f.trade ? [L.o.get(f.trade)!] : f.sector ? L.bySector.get(f.sector)! : trades.map((_, i) => i);
  const out: CellRow[] = [];
  for (const di of dIdx) for (const oi of oIdx) {
    const row = cellAt(di, oi);
    if (f.all || row.act) out.push(row);
  }
  return out;
}

/** One row per trade, for the nation or a single state. */
export function tradeRows(state?: string): TradeRow[] {
  const { trades } = taxonomy();
  const a = agg();
  const col = state ? a.stateTrade : a.nationTrade;
  const base = state ? lookups().g.get(state)! * trades.length : 0;
  return trades.map((t, o) => ({
    trade: t.id, ...balance(col, base + o), cdi: col.cdi[base + o], mom: col.mom[base + o],
    realloc: col.realloc[base + o], growth: col.growth?.[base + o], broke: col.broke?.[base + o],
  }));
}

export interface Scope { state?: string; district?: string }

/** One row per sector for the nation, a state or a district. */
export function sectorRows(scope: Scope = {}): GroupRow[] {
  const { sectors } = taxonomy();
  const a = agg();
  const L = lookups();
  const [col, base] = scope.district
    ? [a.districtSector, L.d.get(scope.district)! * sectors.length]
    : scope.state ? [a.stateSector, L.g.get(scope.state)! * sectors.length] : [a.nationSector, 0];
  return sectors.map((s, k) => ({ id: s.id, ...balance(col, base + k), mi: col.mi[base + k] }));
}

/** All trades together for the nation, a state or a district. */
export function overall(scope: Scope = {}): GroupRow {
  const a = agg();
  const L = lookups();
  const [col, i] = scope.district
    ? [a.districtAll, L.d.get(scope.district)!]
    : scope.state ? [a.stateAll, L.g.get(scope.state)!] : [a.nationAll, 0];
  return { id: "all", ...balance(col, i), mi: col.mi[i] };
}

export interface LayerBy { sector?: string; trade?: string }
export interface LayerRow extends Balance { id: string; mi?: number; act?: number; conf?: number }

/** A map layer: one row per district (of a state, or of every pilot state) for all trades, a sector or a trade. */
export function districtLayer(state: string | undefined, by: LayerBy = {}): LayerRow[] {
  const L = lookups();
  const { districts } = geo();
  const { sectors, trades } = taxonomy();
  const a = agg();
  const idx = state ? L.byState.get(state)! : districts.map((_, i) => i);
  return idx.map((di) => {
    const id = districts[di].id;
    if (by.trade) {
      const c = cellAt(di, L.o.get(by.trade)!);
      return { id, ...balance(cellsRaw(), di * trades.length + L.o.get(by.trade)!), act: c.act, conf: c.conf };
    }
    if (by.sector) {
      const i = di * sectors.length + L.s.get(by.sector)!;
      return { id, ...balance(a.districtSector, i), mi: a.districtSector.mi[i] };
    }
    return { id, ...balance(a.districtAll, di), mi: a.districtAll.mi[di] };
  });
}

/** One row per pilot state for all trades, a sector or a trade. */
export function stateLayer(by: LayerBy = {}): LayerRow[] {
  const L = lookups();
  const { states } = geo();
  const { sectors, trades } = taxonomy();
  const a = agg();
  return states.map((s, g) => {
    if (by.trade) return { id: s.id, ...balance(a.stateTrade, g * trades.length + L.o.get(by.trade)!) };
    if (by.sector) {
      const i = g * sectors.length + L.s.get(by.sector)!;
      return { id: s.id, ...balance(a.stateSector, i), mi: a.stateSector.mi[i] };
    }
    return { id: s.id, ...balance(a.stateAll, g), mi: a.stateAll.mi[g] };
  });
}

export function series(scope: Scope = {}): SeriesFile {
  if (scope.district) return load<SeriesFile>(`series/district/${scope.district}.json`);
  if (scope.state) return load<SeriesFile>(`series/state-${scope.state}.json`);
  return load<SeriesFile>("series/national.json");
}

export interface FlagFilter { state?: string; district?: string; trade?: string; sector?: string; severity?: string; level?: string }
export function flags(f: FlagFilter = {}): Flag[] {
  const L = lookups();
  const { districts } = geo();
  const { trades } = taxonomy();
  return load<Flag[]>("flags.json").filter((x) => {
    const st = x.level === "state" ? x.geo : districts[L.d.get(x.geo)!].state;
    if (f.state && st !== f.state) return false;
    if (f.district && x.geo !== f.district) return false;
    if (f.trade && x.trade !== f.trade) return false;
    if (f.sector && trades[L.o.get(x.trade)!].sector !== f.sector) return false;
    if (f.severity && x.severity !== f.severity) return false;
    if (f.level && x.level !== f.level) return false;
    return true;
  });
}

interface PlanFile { state: string; fy: number; columns: string[]; rows: (string | number)[][] }
export function plan(state: string): PlanRow[] {
  const f = load<PlanFile>(`plan-${state}.json`);
  return f.rows.map((r) => Object.fromEntries(f.columns.map((c, i) => [c, r[i]])) as unknown as PlanRow);
}

export function projects(f: { state?: string; district?: string } = {}): Project[] {
  return load<Project[]>("pipeline.json").filter(
    (p) => (!f.state || p.state === f.state) && (!f.district || p.district === f.district),
  );
}
