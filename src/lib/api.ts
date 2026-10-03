// Helpers for the public REST API: consistent envelopes, CSV output and CORS.
import { geo, meta, taxonomy } from "./data";
import { classOf } from "./scale";
import type { CellRow, Flag } from "./types";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" };

export function ok(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers: { ...CORS, "cache-control": "public, max-age=300", ...init.headers } });
}
export function fail(status: number, message: string) {
  return Response.json({ error: { status, message } }, { status, headers: CORS });
}
export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function envelope(extra: Record<string, unknown> = {}) {
  const m = meta();
  return { dataAsOf: m.dataAsOf, planFY: m.planFY, demo: m.demo, ...extra };
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function csv(rows: Record<string, unknown>[], filename: string, columns?: string[]) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const body = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  return new Response("﻿" + body, {
    headers: { ...CORS, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}.csv"` },
  });
}

export const CONF = ["low", "medium", "high"] as const;

let names: { d: Map<string, { name: string; state: string }>; t: Map<string, { name: string; sector: string; nco: string }> } | undefined;
export function nameIndex() {
  if (!names) {
    names = {
      d: new Map(geo().districts.map((x) => [x.id, { name: x.name, state: x.state }])),
      t: new Map(taxonomy().trades.map((x) => [x.id, { name: x.name, sector: x.sector, nco: x.nco }])),
    };
  }
  return names;
}

/** A district x trade row in the API's public vocabulary. */
export function publicCell(c: CellRow) {
  const n = nameIndex();
  const d = n.d.get(c.district)!;
  const t = n.t.get(c.trade)!;
  return {
    district: c.district, districtName: d.name, state: d.state,
    trade: c.trade, tradeName: t.name, sector: t.sector, nco: t.nco,
    demandNow: c.dn, supplyNow: c.sn, scoreNow: c.s0, classNow: classOf(c.s0),
    demandNext: c.dx, demandLow: c.lo, demandHigh: c.hi, supplyNext: c.sx,
    gapNext: c.dx - c.sx, scoreNext: c.s1, classNext: classOf(c.s1),
    demandIndex: c.cdi, momentumPct: c.mom, confidence: CONF[c.conf],
    seatsCurrent: c.seats, seatsDraft: c.draft, placementPct: c.plc < 0 ? null : c.plc,
    projectOpenings: c.up,
  };
}

export function publicFlag(f: Flag) {
  const n = nameIndex();
  const d = f.level === "district" ? n.d.get(f.geo) : undefined;
  return {
    id: f.id, severity: f.severity, type: f.type, level: f.level,
    geo: f.geo, geoName: d?.name ?? geo().states.find((s) => s.id === f.geo)?.name ?? f.geo, state: d?.state ?? f.geo,
    trade: f.trade, tradeName: n.t.get(f.trade)!.name, sector: n.t.get(f.trade)!.sector,
    fromClass: f.from_class, toClass: f.to_class, leadMonths: f.lead, crossingMonth: f.month,
    scoreNow: f.score_now, scoreNext: f.score_next, demandNext: f.d_next, supplyNext: f.s_next, gapNext: f.gap,
    likelihood: ["", "uncertain", "possible", "likely"][f.likelihood], confidence: CONF[f.conf], projectShare: f.project_share,
  };
}

export const intParam = (v: string | null, def: number, min: number, max: number) => {
  const n = v === null ? def : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
};
