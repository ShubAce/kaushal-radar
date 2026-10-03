"""Gap metrics, severity scores, early-warning flags and the seat plan.

  balance     compares demand D (entry-level openings) with supply S (certified
              candidates entering the labour market) over the same 12 months.
  score       100 * tanh(K * ln(D / S)), from -100 (saturated) to +100 (acute
              shortage). Symmetric: twice the demand scores the same magnitude
              as twice the supply.
  flags       fire on the trajectory, not the level: a trade that is balanced
              today but forecast to cross a threshold within 18 months.
  plan        recommends seats for the next training cycle, cell by cell, with
              a reason code and limits on how fast capacity can change.
"""
from __future__ import annotations

import numpy as np

from config import (CLASS_CUTS, FUNNEL, PLAN_BAND, PLAN_MAX_DOWN, PLAN_MAX_UP, SCORE_K, SECTORS, TRADES)
from forecast import band_for

CLASSES = ("saturated", "surplus", "balanced", "shortage", "acute_shortage")
MIN_ACTIVE = 12.0        # a cell with under 12 openings and 12 entrants a year is not ranked
PAD = 3.0                # stabilises the ratio in tiny cells


def score(d: np.ndarray, s: np.ndarray) -> np.ndarray:
    return 100.0 * np.tanh(SCORE_K * np.log((d + PAD) / (s + PAD)))


def classify(sc: np.ndarray) -> np.ndarray:
    """0 saturated, 1 surplus, 2 balanced, 3 shortage, 4 acute shortage."""
    lo, hi = CLASS_CUTS
    return np.digitize(sc, [-hi, -lo, lo, hi])


def rolling12(hist: np.ndarray, fut: np.ndarray) -> np.ndarray:
    """Trailing 12-month totals for every month of history (from month 12) and forecast."""
    full = np.concatenate([hist, fut], axis=-1)
    c = np.cumsum(full, axis=-1)
    out = c.copy()
    out[..., 12:] = c[..., 12:] - c[..., :-12]
    return out


def cell_metrics(est, fc, up_lo, up_hi, supply, bands, H, plan_slice):
    """Per district x trade: demand and supply now (last 12 months) and in the planning year."""
    d_now = est[:, :, -12:].sum(axis=2)
    d_prev = est[:, :, -24:-12].sum(axis=2)
    s_now = supply[:, :, H - 12:H].sum(axis=2)
    d_next = fc[:, :, plan_slice].sum(axis=2)
    s_next = supply[:, :, H:][:, :, plan_slice].sum(axis=2)
    lo, hi = band_for(d_next, plan_slice.stop, bands)
    lo = np.maximum(lo - up_lo[:, :, plan_slice].sum(axis=2), 0)
    hi = hi + up_hi[:, :, plan_slice].sum(axis=2)
    sc0, sc1 = score(d_now, s_now), score(d_next, s_next)
    active = (np.maximum(d_now, d_next) >= MIN_ACTIVE) | (np.maximum(s_now, s_next) >= MIN_ACTIVE)
    width = (hi - lo) / np.maximum(d_next, 1.0)
    conf = np.where((width < 0.55) & (d_now >= 100), 2, np.where((width < 0.95) & (d_now >= 25), 1, 0))
    robust = classify(score(lo, s_next)) == classify(score(hi, s_next))
    return dict(d_now=d_now, d_prev=d_prev, s_now=s_now, d_next=d_next, s_next=s_next, lo=lo, hi=hi,
                sc0=sc0, sc1=sc1, cls0=classify(sc0), cls1=classify(sc1), active=active, conf=conf,
                robust=robust, gap=d_next - s_next, mom=(d_now + 1) / (d_prev + 1) - 1)


def first_cross(traj: np.ndarray, target_cls: np.ndarray, rising: np.ndarray) -> np.ndarray:
    """Months until the rolling score first reaches the target class (0 if never)."""
    cls = classify(traj)                                                    # [..., h]
    hit = np.where(rising[..., None], cls >= target_cls[..., None], cls <= target_cls[..., None])
    first = np.argmax(hit, axis=-1) + 1
    return np.where(hit.any(axis=-1), first, 0)


def build_flags(m, d_roll, s_roll, lo_roll, hi_roll, H, uplift_next, level, ids, trades, min_gap, labels):
    """Flags for one level (district or state). d_roll etc. are trailing-12-month series incl. forecast."""
    out = []
    h = d_roll.shape[-1] - H
    traj = score(d_roll[..., H:], s_roll[..., H:])
    traj_lo = score(lo_roll, s_roll[..., H:])
    traj_hi = score(hi_roll, s_roll[..., H:])
    c0, c1 = m["cls0"], m["cls1"]
    rising = c1 > c0
    moved = (c1 != c0) & m["active"] & (np.abs(m["gap"]) >= min_gap) & (c1 != 2)
    lead = first_cross(traj, c1, rising)
    # how many of the low / central / high demand paths end in the same class
    agree = (classify(traj_lo[..., -1]) == c1).astype(int) + (classify(traj_hi[..., -1]) == c1).astype(int) + 1
    for i, j in zip(*np.where(moved)):
        to = int(c1[i, j])
        frm = int(c0[i, j])
        kind = {(True, 4): "deepening_shortage" if frm == 3 else "emerging_shortage",
                (True, 3): "emerging_shortage",
                (False, 0): "deepening_saturation" if frm == 1 else "approaching_saturation",
                (False, 1): "approaching_saturation"}.get((bool(rising[i, j]), to))
        if kind is None:                                                    # e.g. a shortage easing back toward balance
            continue
        gap = float(m["gap"][i, j])
        conf = int(m["conf"][i, j])
        likelihood = int(agree[i, j])                                        # 3 likely, 2 possible, 1 uncertain
        extreme = to in (0, 4)
        if extreme and abs(gap) >= 4 * min_gap and likelihood >= 2:
            sev = "critical"
        elif abs(gap) >= 2 * min_gap and likelihood >= 2:
            sev = "warning"
        else:
            sev = "watch"
        out.append(dict(
            level=level, geo=ids[i], trade=trades[j]["id"], type=kind, severity=sev,
            lead=int(lead[i, j]) or h, month=labels[min(int(lead[i, j]) or h, h) - 1],
            from_class=CLASSES[frm], to_class=CLASSES[to],
            score_now=round(float(m["sc0"][i, j])), score_next=round(float(m["sc1"][i, j])),
            d_now=round(float(m["d_now"][i, j])), s_now=round(float(m["s_now"][i, j])),
            d_next=round(float(m["d_next"][i, j])), s_next=round(float(m["s_next"][i, j])),
            gap=round(gap), likelihood=likelihood, conf=conf,
            project_share=round(float(uplift_next[i, j] / max(m["d_next"][i, j], 1.0)), 2),
            priority=round(float(abs(m["sc1"][i, j]) / 100 * np.log10(1 + abs(gap)) * (0.65, 0.85, 1.0)[conf]), 3),
        ))
    return out


def build_plan(m, seats_draft, util, growth_cell, districts):
    """Unconstrained seat recommendation for the planning year, per district x trade.

    need  = seats required so that entrants match demand when the cohort graduates
    rec   = draft moved toward need, limited to +40% / -30% in one cycle
    The budget constraint is applied later, interactively, in the planner.
    """
    D, O = seats_draft.shape
    conv = np.zeros((D, O))
    grad = np.zeros((D, O))
    for o, tr in enumerate(TRADES):
        f = FUNNEL[tr["kind"]]
        conv[:, o] = util[:, o] * f["complete"] * f["certify"] * f["entry"]
        grad[:, o] = np.exp(0.85 * growth_cell[:, o] * tr["dur"] / 12.0)        # demand growth until graduation
    demand = m["d_next"] * grad
    need = demand / np.maximum(conv, 0.05)
    rec = seats_draft.copy()
    reason = np.full((D, O), "hold", dtype=object)

    small = (need < 15) & (seats_draft < 15)
    over = (seats_draft > need * (1 + PLAN_BAND)) & ~small
    under = (seats_draft < need * (1 - PLAN_BAND)) & ~small
    new = under & (seats_draft < 10) & (need >= 30)

    cut_to = np.maximum(need, seats_draft * (1 - PLAN_MAX_DOWN))
    rec = np.where(over, cut_to, rec)
    reason[over & (m["cls1"] == 0)] = "cut_saturated"
    reason[over & (m["cls1"] != 0)] = "cut_surplus"
    reason[over & (cut_to > need * 1.02)] = "cut_capped"

    raise_to = np.minimum(need, seats_draft * (1 + PLAN_MAX_UP))
    rec = np.where(under & ~new, raise_to, rec)
    reason[under & ~new & (m["cls1"] == 4)] = "raise_acute"
    reason[under & ~new & (m["cls1"] != 4)] = "raise_shortage"
    reason[under & ~new & (raise_to < need * 0.98)] = "raise_capped"

    rec = np.where(new, np.minimum(need, 60.0), rec)                           # start a new course with up to two batches
    reason[new] = "new_course"
    reason[small] = "hold_small"

    low = (m["conf"] == 0) & (over | under) & ~new                             # thin evidence: move half as far
    rec = np.where(low, seats_draft + 0.5 * (rec - seats_draft), rec)
    rec = np.round(rec / 5.0) * 5.0                                             # seats come in batches
    rec = np.where(reason == "hold", seats_draft, rec)
    rec = np.where(reason == "hold_small", seats_draft, rec)

    rows = []
    for i in range(D):
        for o in range(O):
            if seats_draft[i, o] <= 0 and rec[i, o] <= 0:
                continue
            rows.append([i, o, int(seats_draft[i, o]), int(round(need[i, o])), int(rec[i, o]),
                         round(float(conv[i, o]), 3), int(round(demand[i, o])), str(reason[i, o]),
                         int(m["conf"][i, o]), int(round(m["sc1"][i, o]))])
    return rows, dict(conv=conv, need=need, rec=rec, demand=demand)


def aggregate(d_now, s_now, d_next, s_next, lo, hi, groups: np.ndarray, n: int, axis: int):
    """Sum cell metrics over districts (axis 0) or trades (axis 1) into n groups."""
    def g(a):
        if axis == 0:
            return np.stack([a[groups == k].sum(axis=0) for k in range(n)])
        return np.stack([a[:, groups == k].sum(axis=1) for k in range(n)], axis=1)
    out = {k: g(v) for k, v in dict(d_now=d_now, s_now=s_now, d_next=d_next, s_next=s_next).items()}
    # interval of a sum, treating members as independent
    out["lo"] = out["d_next"] - np.sqrt(g((d_next - lo) ** 2))
    out["hi"] = out["d_next"] + np.sqrt(g((hi - d_next) ** 2))
    return out
