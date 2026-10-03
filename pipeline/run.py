"""Run the whole pipeline and write the JSON artefacts the web app and API serve.

    python pipeline/run.py                                  demo data, generated
    python pipeline/run.py --export-inputs pipeline/inputs  write the demo data as input CSVs, then stop
    python pipeline/run.py --inputs pipeline/inputs         run on CSV files instead (see inputs.py)

Order: districts -> source data -> demand index -> back-test -> forecast ->
gaps, flags, plan -> data/*.json
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import config as C
from forecast import HORIZONS, SIZE_EDGES, backtest, band_for, forecast_all
from gap import CLASSES, aggregate, build_flags, build_plan, cell_metrics, classify, rolling12, score
from geo import load_districts
from index import SRC, build_index, recovery_test
from inputs import InputError, export_inputs, load_inputs
from synth import fy_of, generate


# ------------------------------------------------------------------ helpers --
def nums(a, nd=0):
    a = np.round(np.nan_to_num(np.asarray(a, float)), nd)
    return [int(x) if float(x).is_integer() else float(x) for x in a.ravel()]


def series(a):
    return nums(a, 0 if np.nanmax(a) >= 60 else 1)


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def level_block(a):
    """Common derived fields for an aggregate: scores, classes, gap."""
    sc0, sc1 = score(a["d_now"], a["s_now"]), score(a["d_next"], a["s_next"])
    return dict(dn=nums(a["d_now"]), sn=nums(a["s_now"]), dx=nums(a["d_next"]), sx=nums(a["s_next"]),
                lo=nums(a["lo"]), hi=nums(a["hi"]), s0=nums(sc0), s1=nums(sc1))


def mismatch(d, s, groups, n, axis):
    """Share of activity that is in the wrong place: sum |D - S| / sum max(D, S) within each group."""
    num, den = np.abs(d - s), np.maximum(d, s)
    if axis == 1:
        a = np.stack([num[:, groups == k].sum(axis=1) for k in range(n)], axis=1)
        b = np.stack([den[:, groups == k].sum(axis=1) for k in range(n)], axis=1)
    else:
        a = np.stack([num[groups == k].sum(axis=0) for k in range(n)])
        b = np.stack([den[groups == k].sum(axis=0) for k in range(n)])
    return a / np.maximum(b, 1.0)


def main(args):
    t_start = time.time()
    districts = load_districts()
    if args.inputs:
        g = load_inputs(Path(args.inputs), districts)
        print(f"read {len(g['files'])} input file(s) from {args.inputs}: {', '.join(g['files'])}")
        for note in g["notes"]:
            print("  note:", note)
    else:
        g = generate(districts)
    if args.export_inputs:
        for name, n in export_inputs(g, districts, Path(args.export_inputs)).items():
            print(f"{name:32s}{n:>10,} rows")
        return
    supplied = g["truth"] is None                       # real feeds: no hidden truth to test against
    idx, H, sidx, sector_of = g["idx"], g["H"], g["sidx"], g["sector_of"]
    D, O, G, S = len(districts), len(C.TRADES), len(C.STATES), len(C.SECTORS)
    h = C.N_FUT
    states = list(C.STATES)
    wa = districts["wa"].to_numpy(float)

    # ------------------------------------------------------------ the models
    anchor = (g["bench_district"], g["bench_district_fy"]) if g["bench_district"] is not None else None
    ix = build_index(g["signals"], g["bench"], districts, idx, sidx, sector_of, anchor=anchor)
    est = ix["est"]
    rec = None if supplied else recovery_test(est, ix["x"], g["signals"], g["truth"], idx)
    bt = backtest(g["signals"], g["bench"], g["enterprise"], districts, idx, sidx, sector_of, est, ix["tilt"])
    f = forecast_all(est, g["enterprise"], districts, idx, sidx, sector_of, h=h)
    fc, supply = f["fc"], g["supply"]

    months = [str(p) for p in idx]
    first_plan = months.index(f"{C.PLAN_FY - 1}-04") - H
    plan = slice(first_plan, first_plan + 12)
    assert plan.stop <= h, "planning year must lie inside the forecast horizon"

    # ---------------------------------------------------------- cell metrics
    m = cell_metrics(est, fc, f["up_lo"], f["up_hi"], supply, bt["bands"], H, plan)
    fys = np.array([fy_of(p) for p in idx[:H]])
    base_rate = est[:, :, fys == 2025].sum(axis=(0, 2)) / wa.sum()              # FY25 openings per working-age person
    cdi = 100.0 * (m["d_now"] / wa[:, None]) / np.maximum(base_rate[None, :], 1e-12)
    j27, j28 = g["fy_list"].index(2027), g["fy_list"].index(2028)
    seats_now, seats_draft = g["seats"][:, :, j27], g["seats"][:, :, j28]
    uplift_next = f["uplift"][:, :, plan].sum(axis=2)
    plc = np.where(np.isnan(g["placement"]), -1, np.round(g["placement"] * 100))

    cells = dict(
        dn=nums(m["d_now"]), sn=nums(m["s_now"]), dx=nums(m["d_next"]), sx=nums(m["s_next"]),
        lo=nums(m["lo"]), hi=nums(m["hi"]), s0=nums(m["sc0"]), s1=nums(m["sc1"]),
        cdi=nums(cdi), mom=nums(m["mom"] * 100), conf=nums(m["conf"]), act=nums(m["active"]),
        rob=nums(m["robust"]), seats=nums(seats_now), draft=nums(seats_draft), plc=nums(plc), up=nums(uplift_next),
    )

    # ------------------------------------------------------------ aggregates
    def trade_level(groups, n, bands_key):
        a = {k: np.stack([m[k][groups == q].sum(axis=0) for q in range(n)]) for k in ("d_now", "d_prev", "s_now", "d_next", "s_next")}
        lo, hi = band_for(a["d_next"], plan.stop, bt["bands_up"][bands_key])
        a["lo"] = np.maximum(lo - np.stack([f["up_lo"][groups == q][:, :, plan].sum(axis=(0, 2)) for q in range(n)]), 0)
        a["hi"] = hi + np.stack([f["up_hi"][groups == q][:, :, plan].sum(axis=(0, 2)) for q in range(n)])
        return a

    st = trade_level(sidx, G, "state")                                         # [G, O]
    nat = trade_level(np.zeros(D, int), 1, "national")                         # [1, O]
    st_wa = np.array([wa[sidx == q].sum() for q in range(G)])
    # seats that could be fixed by moving them between districts of the same state
    over = np.maximum(m["s_next"] - m["d_next"], 0)
    short = np.maximum(m["d_next"] - m["s_next"], 0)
    movable = np.minimum(np.stack([over[sidx == q].sum(axis=0) for q in range(G)]),
                         np.stack([short[sidx == q].sum(axis=0) for q in range(G)]))
    st_block = level_block(st)
    st_block.update(cdi=nums(100 * (st["d_now"] / st_wa[:, None]) / base_rate[None, :]),
                    mom=nums(((st["d_now"] + 1) / (st["d_prev"] + 1) - 1) * 100),
                    realloc=nums(100 * movable / np.maximum(st["s_next"], 1)),
                    growth=nums(np.expm1(f["growth"]) * 100, 1), broke=nums(f["broke"]))
    nat_block = level_block(nat)
    nat_block.update(cdi=nums(100 * (nat["d_now"] / wa.sum()) / base_rate[None, :]),
                     mom=nums(((nat["d_now"] + 1) / (nat["d_prev"] + 1) - 1) * 100),
                     realloc=nums(100 * np.minimum(over.sum(axis=0), short.sum(axis=0)) / np.maximum(nat["s_next"], 1)))

    def over_trades(src, lo, hi):
        """Sector and all-trade totals for any geography level [N, O]."""
        sec = aggregate(src["d_now"], src["s_now"], src["d_next"], src["s_next"], lo, hi, sector_of, S, axis=1)
        allt = aggregate(src["d_now"], src["s_now"], src["d_next"], src["s_next"], lo, hi, np.zeros(O, int), 1, axis=1)
        sec_b, all_b = level_block(sec), level_block(allt)
        sec_b["mi"] = nums(100 * mismatch(src["d_next"], src["s_next"], sector_of, S, 1))
        all_b["mi"] = nums(100 * mismatch(src["d_next"], src["s_next"], np.zeros(O, int), 1, 1))
        return sec_b, all_b

    d_sec, d_all = over_trades(m, m["lo"], m["hi"])
    s_sec, s_all = over_trades(st, st["lo"], st["hi"])
    n_sec, n_all = over_trades(nat, nat["lo"], nat["hi"])
    agg = dict(stateTrade=st_block, nationTrade=nat_block, districtSector=d_sec, districtAll=d_all,
               stateSector=s_sec, stateAll=s_all, nationSector=n_sec, nationAll=n_all)

    # ----------------------------------------------------------- time series
    d_roll = rolling12(est, fc)                                                 # [D, O, H + h]
    s_roll = rolling12(supply[:, :, :H], supply[:, :, H:])
    up_lo_roll = rolling12(np.zeros((D, O, 12)), f["up_lo"])[:, :, 12:]         # rolling sums inside the horizon
    up_hi_roll = rolling12(np.zeros((D, O, 12)), f["up_hi"])[:, :, 12:]
    win = slice(H - C.DISPLAY_HIST, H + h)

    def bands_roll(roll, table, lo_adj, hi_adj):
        lo = np.zeros(roll.shape[:-1] + (h,))
        hi = np.zeros_like(lo)
        for j in range(1, h + 1):
            a, b = band_for(roll[..., H + j - 1], j, table)
            lo[..., j - 1] = np.maximum(a - lo_adj[..., j - 1], 0)
            hi[..., j - 1] = b + hi_adj[..., j - 1]
        return lo, hi

    lo_d, hi_d = bands_roll(d_roll, bt["bands"], up_lo_roll, up_hi_roll)

    def sum_states(a):
        return np.stack([a[sidx == q].sum(axis=0) for q in range(G)])

    d_roll_s, s_roll_s = sum_states(d_roll), sum_states(s_roll)
    lo_s, hi_s = bands_roll(d_roll_s, bt["bands_up"]["state"], sum_states(up_lo_roll), sum_states(up_hi_roll))
    d_roll_n, s_roll_n = d_roll.sum(axis=0), s_roll.sum(axis=0)
    lo_n, hi_n = bands_roll(d_roll_n, bt["bands_up"]["national"], up_lo_roll.sum(axis=0), up_hi_roll.sum(axis=0))

    def pack(d, s, lo, hi):
        return dict(d=series(d[win]), s=series(s[win]), lo=series(lo), hi=series(hi))

    def pack_groups(d, s, lo, hi):
        """d, s [O, T]; lo, hi [O, h] -> trades, sector totals and the all-trade total."""
        out = dict(trades={}, sectors={}, all=None)
        for o, tr in enumerate(C.TRADES):
            out["trades"][tr["id"]] = pack(d[o], s[o], lo[o], hi[o])
        mid = d[:, H:]
        for k, sec in enumerate(C.SECTORS):
            q = sector_of == k
            out["sectors"][sec["id"]] = pack(d[q].sum(0), s[q].sum(0),
                                             mid[q].sum(0) - np.sqrt(((mid[q] - lo[q]) ** 2).sum(0)),
                                             mid[q].sum(0) + np.sqrt(((hi[q] - mid[q]) ** 2).sum(0)))
        out["all"] = pack(d.sum(0), s.sum(0), mid.sum(0) - np.sqrt(((mid - lo) ** 2).sum(0)),
                          mid.sum(0) + np.sqrt(((hi - mid) ** 2).sum(0)))
        return out

    out = Path(args.out) if args.out else C.OUT
    if (out / "series").exists():                        # keep data/geo, which build_geo.mjs owns
        shutil.rmtree(out / "series")
    write(out / "series" / "national.json", pack_groups(d_roll_n, s_roll_n, lo_n, hi_n))
    for q, code in enumerate(states):
        write(out / "series" / f"state-{code}.json", pack_groups(d_roll_s[q], s_roll_s[q], lo_s[q], hi_s[q]))

    x_ann = {s: np.nanmean(ix["x"][s][:, :, -12:], axis=2) * 12 for s in SRC}       # each source's own estimate
    raw_ann = {s: np.nansum(ix["obs"][s][:, :, -12:], axis=2) for s in SRC}
    fy_keys = [2025, 2026, 2027, 2028]
    for i, row in districts.iterrows():
        block = pack_groups(d_roll[i], s_roll[i], lo_d[i], hi_d[i])
        detail = {}
        for o, tr in enumerate(C.TRADES):
            if not m["active"][i, o]:
                block["trades"].pop(tr["id"])
                continue
            detail[tr["id"]] = dict(
                src={s: round(float(x_ann[s][i, o]), 1) for s in SRC},
                raw={s: int(raw_ann[s][i, o]) for s in SRC},
                w={s: round(float(ix["wcell"][k, i, o]), 2) for k, s in enumerate(SRC)},
                seats={str(fy): int(g["seats"][i, o, g["fy_list"].index(fy)]) for fy in fy_keys},
                enrolled=int(round(g["enrolled"][i, o, H - 12:H].sum())),
                certified=int(round(g["certified"][i, o, H - 12:H].sum())),
                entrants=int(round(supply[i, o, H - 12:H].sum())),
                eshram=int(g["eshram"][i, o]),
            )
        block["detail"] = detail
        write(out / "series" / "district" / f"{row['id']}.json", block)

    # ------------------------------------------------------------------ flags
    labels = months[H:H + h]
    flags = build_flags(m, d_roll, s_roll, lo_d, hi_d, H, uplift_next, "district", districts["id"].tolist(), C.TRADES, 40, labels)
    ms = dict(d_now=st["d_now"], s_now=st["s_now"], d_next=st["d_next"], s_next=st["s_next"], gap=st["d_next"] - st["s_next"])
    ms.update(sc0=score(st["d_now"], st["s_now"]), sc1=score(st["d_next"], st["s_next"]), active=np.ones((G, O), bool))
    ms.update(cls0=classify(ms["sc0"]), cls1=classify(ms["sc1"]),
              conf=np.where((st["hi"] - st["lo"]) / np.maximum(st["d_next"], 1) < 0.45, 2, 1))
    flags += build_flags(ms, d_roll_s, s_roll_s, lo_s, hi_s, H, sum_states(uplift_next), "state", states, C.TRADES, 150, labels)
    # a state-wide break in the demand trend is itself an early signal
    for q in range(G):
        for o, tr in enumerate(C.TRADES):
            if not f["broke"][q, o]:
                continue
            up = f["accel"][q, o] > 0
            flags.append(dict(
                level="state", geo=states[q], trade=tr["id"], type="demand_accelerating" if up else "demand_slowing",
                severity="warning" if abs(f["accel"][q, o]) > 0.3 else "watch", lead=0, month=months[H - 1],
                from_class=CLASSES[int(ms["cls0"][q, o])], to_class=CLASSES[int(ms["cls1"][q, o])],
                score_now=round(float(ms["sc0"][q, o])), score_next=round(float(ms["sc1"][q, o])),
                d_now=round(float(st["d_now"][q, o])), s_now=round(float(st["s_now"][q, o])),
                d_next=round(float(st["d_next"][q, o])), s_next=round(float(st["s_next"][q, o])),
                gap=round(float(ms["gap"][q, o])), likelihood=2, conf=int(ms["conf"][q, o]),
                project_share=0.0, accel=round(float(np.expm1(f["accel"][q, o]) * 100)),
                priority=round(float(abs(f["accel"][q, o]) * np.log10(1 + st["d_now"][q, o])), 3)))
    rank = {"critical": 0, "warning": 1, "watch": 2}
    flags.sort(key=lambda x: (rank[x["severity"]], -x["priority"]))
    for n, fl in enumerate(flags):
        fl["id"] = f"F{n + 1:04d}"
    write(out / "flags.json", flags)

    # ------------------------------------------------------------------- plan
    # the fill rate of a course that does not exist yet cannot be observed: assume the trade's usual rate
    ref = g["seats"][:, :, g["fy_list"].index(2026)]
    usual = (g["util"] * ref).sum(axis=0) / np.maximum(ref.sum(axis=0), 1)
    util = np.where(ref > 0, g["util"], np.where(usual > 0, usual, g["util"].mean(axis=0))[None, :])
    rows, pl = build_plan(m, seats_draft, util, f["growth"][sidx], districts)
    ids, tids = districts["id"].tolist(), [t["id"] for t in C.TRADES]
    plan_summary = {}
    for q, code in enumerate(states):
        mine = [[ids[r[0]], tids[r[1]], *r[2:]] for r in rows if sidx[r[0]] == q]
        write(out / f"plan-{code}.json", dict(state=code, fy=C.PLAN_FY,
              columns=["district", "trade", "draft", "need", "rec", "conv", "demand", "reason", "conf", "score"], rows=mine))
        draft = sum(r[2] for r in mine)
        plan_summary[code] = dict(draft=int(draft), rec=int(sum(r[4] for r in mine)),
                                  up=int(sum(max(r[4] - r[2], 0) for r in mine)),
                                  down=int(sum(max(r[2] - r[4], 0) for r in mine)), rows=len(mine))

    # ------------------------------------------------------------- reference
    geo = dict(
        states=[dict(id=code, name=meta["name"], lang=meta["lang"], districts=int((sidx == q).sum()),
                     pop=int(districts["pop"][sidx == q].sum()), wa=int(wa[sidx == q].sum()))
                for q, (code, meta) in enumerate(C.STATES.items())],
        districts=[dict(id=r["id"], name=r["name"], state=r["state"], pop=int(r["pop"]), wa=int(r["wa"]),
                        urban=round(float(r["urban"]) * 100), basis=r["basis"]) for _, r in districts.iterrows()],
    )
    write(out / "geo.json", geo)

    yields = g["yield_"]
    taxonomy = dict(
        sectors=[dict(id=s["id"], name=s["name"], hi=s["hi"], ssc=s["ssc"]) for s in C.SECTORS],
        trades=[dict(id=t["id"], name=t["name"], hi=t["hi"], sector=t["sector"], nco=t["nco"], ncoTitle=t["nco_title"],
                     nsqf=t["nsqf"], kind=t["kind"], months=t["dur"], qp=t["qp"], emerging=t["emerging"],
                     yield_=round(float(yields[o]), 3), base=float(base_rate[o])) for o, t in enumerate(C.TRADES)],
        classes=list(CLASSES),
    )
    write(out / "taxonomy.json", taxonomy)
    write(out / "cells.json", cells)
    write(out / "agg.json", agg)

    did = {(s, r): i for i, (s, r) in enumerate(zip(districts["state"], districts["raw"]))}
    projects = []
    for pr in C.PIPELINE:
        i = did[(pr["state"], pr["district"])]
        projects.append(dict(id=pr["id"], district=ids[i], state=pr["state"], month=pr["month"], title=pr["title"],
                             sector=pr["sector"], jobs=pr["jobs"], total=int(sum(pr["jobs"].values())), p=pr["p"]))
    write(out / "pipeline.json", projects)

    # -------------------------------------------------------------- method
    sec_ids = [s["id"] for s in C.SECTORS]
    src_meta = []
    for k, s in enumerate(C.SOURCES):
        kap = ix["kappa"][s["id"]]
        src_meta.append(dict(
            id=s["id"], name=s["name"], standsFor=s["stands_for"], freq=s["freq"], lagMonths=s["lag"],
            records=int(ix["records"][s["id"]]),
            coverage=dict(mean=round(float(kap.mean()), 3), min=round(float(kap.min()), 3), max=round(float(kap.max()), 3)),
            coverageByTrade={t["id"]: round(float(kap[:, o].mean()), 3) for o, t in enumerate(C.TRADES)},
            noise={sec_ids[q]: round(float(ix["sigma"][k, q]), 2) for q in range(S)},
            weight={sec_ids[q]: round(float(ix["wshare"][k, q]), 3) for q in range(S)},
            tilt={sec_ids[q]: round(float(ix["tilt"][s["id"]][q]), 2) for q in range(S)},
        ))
    # does the index agree with what actually happened to trainees? (rank correlation with placement)
    m26 = fys == 2026
    bal = np.log((est[:, :, m26].sum(axis=2) + 3) / (supply[:, :, :H][:, :, m26].sum(axis=2) + 3))
    okp = ~np.isnan(g["placement"]) & (supply[:, :, :H][:, :, m26].sum(axis=2) >= 20)
    placement_check = None
    if okp.sum() >= 30:
        ra, rb = np.argsort(np.argsort(bal[okp])), np.argsort(np.argsort(g["placement"][okp]))
        placement_check = dict(spearman=round(float(np.corrcoef(ra, rb)[0, 1]), 3), cells=int(okp.sum()), fy=2026)
    lead_test = None
    if g.get("has_enterprise", True):
        lead_test = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in bt["lead_test"].items()}
    quality = g["quality"] or {}

    def wape_tab(v):
        return {lv: {str(hz): round(x, 4) for hz, x in d.items() if x is not None} for lv, d in bt["wape"][v].items()}

    method = dict(
        sources=src_meta,
        recovery=rec and dict(fy=rec["fy"], cells=rec["cells"],
                              index=dict(wape=round(rec["ours"]["wape"], 4), corr=round(rec["ours"]["corr"], 4)),
                              portalOnly=dict(wape=round(rec["portal_only"]["wape"], 4), corr=round(rec["portal_only"]["corr"], 4)),
                              simpleAverage=dict(wape=round(rec["simple_average"]["wape"], 4), corr=round(rec["simple_average"]["corr"], 4))),
        backtest=dict(origins=[months[t - 1] for t in bt["origins"]], horizons=list(HORIZONS),
                      naive=wape_tab("naive"), model=wape_tab("model"),
                      byGroup={k: {str(hz): {a: round(b, 4) for a, b in e.items()} for hz, e in v.items()} for k, v in bt["by_group"].items()},
                      leadTest=lead_test,
                      bands=dict(sizeEdges=list(SIZE_EDGES), district=np.round(bt["bands"], 3).tolist(),
                                 state=np.round(bt["bands_up"]["state"], 3).tolist(),
                                 national=np.round(bt["bands_up"]["national"], 3).tolist())),
        placementCheck=placement_check,
        quality=dict(ncsSpikesDamped=ix["n_spikes"], benchmarkYears=ix["fy_used"],
                     portalRawPostings=int(quality["portal_raw_postings"]) if quality else None,
                     portalDuplicateRate=quality.get("portal_dup_rate"),
                     payrollLagMonths=int(np.isnan(g["signals"]["payroll"][0, 0, :H]).sum())),
        params=dict(shrinkK=C.SHRINK_K, scoreK=C.SCORE_K, classCuts=list(C.CLASS_CUTS), planMaxUp=C.PLAN_MAX_UP,
                    planMaxDown=C.PLAN_MAX_DOWN, planBand=C.PLAN_BAND, funnel=C.FUNNEL),
        trendBreaks=int(f["broke"].sum()),
    )
    write(out / "method.json", method)

    cls1 = np.where(m["active"], m["cls1"], -1)
    meta = dict(
        product="Kaushal Radar", demo=not supplied, inputs=g.get("files", []), generatedAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        dataAsOf=months[H - 1], months=months[win], histLen=C.DISPLAY_HIST, fcLen=h,
        planFY=f"{C.PLAN_FY - 1}-{str(C.PLAN_FY)[2:]}", planMonths=[months[H + plan.start], months[H + plan.stop - 1]],
        counts=dict(states=G, districts=D, sectors=S, trades=O, cells=int(m["active"].sum()),
                    acute=int((cls1 == 4).sum()), shortage=int((cls1 == 3).sum()), balanced=int((cls1 == 2).sum()),
                    surplus=int((cls1 == 1).sum()), saturated=int((cls1 == 0).sum()),
                    flags=len(flags), critical=sum(1 for x in flags if x["severity"] == "critical"),
                    warning=sum(1 for x in flags if x["severity"] == "warning"), projects=len(projects),
                    records=int(sum(ix["records"].values()))),
        totals=dict(demandNow=int(m["d_now"].sum()), supplyNow=int(m["s_now"].sum()), demandNext=int(m["d_next"].sum()),
                    supplyNext=int(m["s_next"].sum()), seatsNow=int(seats_now.sum()), seatsDraft=int(seats_draft.sum()),
                    movable=int(movable.sum()), wa=int(wa.sum()), pop=int(districts["pop"].sum())),
        plan=plan_summary,
    )
    write(out / "meta.json", meta)

    size = sum(p.stat().st_size for p in out.rglob("*.json")) / 1e6
    print(f"wrote {len(list(out.rglob('*.json')))} files, {size:.1f} MB, in {time.time() - t_start:.1f}s")
    print("classes next year:", {k: meta["counts"][k] for k in ("acute", "shortage", "balanced", "surplus", "saturated")})
    print("flags:", {s: sum(1 for x in flags if x["severity"] == s) for s in rank},
          {t: sum(1 for x in flags if x["type"] == t) for t in sorted({x["type"] for x in flags})})
    print("plan:", plan_summary)
    print("recovery:", method["recovery"], "| placement check:", method["placementCheck"])
    print("totals:", meta["totals"])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Build the data files the Kaushal Radar web app and API serve.")
    ap.add_argument("--inputs", metavar="DIR", help="read source data from CSV files in DIR instead of generating demo data")
    ap.add_argument("--export-inputs", metavar="DIR", help="write the source data to DIR in the input format, then stop")
    ap.add_argument("--out", metavar="DIR", help="write results to DIR instead of data/")
    try:
        main(ap.parse_args())
    except InputError as e:
        sys.exit(f"input error: {e}")
