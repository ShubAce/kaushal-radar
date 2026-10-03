"""Demand forecasting.

District x trade series are too noisy to carry their own trend, so growth is
estimated where the data is stable and passed down:

  1. Growth       - year-on-year growth per state x trade (comparing the same
                    months a year apart, so seasonality cancels), shrunk toward
                    the national rate for that trade. If the latest half-year
                    has broken away from the half-year before it, the recent
                    rate is used instead.
  2. State path   - same month last year x growth, so seasonality carries over
                    directly. Rates too small to tell apart from noise are
                    pulled toward zero.
  3. Top-down     - state totals are split across districts by each district's
                    share over the last year. Only a large district that is
                    clearly out-growing its state keeps part of that drift.
                    District numbers always add up to state and national.
  4. Projects     - add expected hiring from announced investment projects.
                    (Tested and rejected: shifting forecasts on new-enterprise
                    registrations. In back-tests it raised error, so it is off;
                    the back-test still reports that comparison.)
  5. Uncertainty  - empirical bands from rolling-origin back-tests.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import PIPELINE, SECTORS, TRADES
from index import build_index

EPS = 1e-9
SIZE_EDGES = (25, 100, 400)                       # annual openings; buckets for uncertainty bands
HORIZONS = (6, 12, 18)
BREAK_PP = 0.15                                   # a 15-point change in annual growth counts as a break
DRIFT_RHO, DRIFT_MIN_SIZE, DRIFT_MIN_REL = 0.5, 200, 0.25   # district share drift: strength and when it applies
GROWTH_NOISE = 0.06                               # annual growth below ~6% is indistinguishable from noise
SHARE_WINDOW = 12                                 # months of history that define a district's share of its state


# ------------------------------------------------------------------ growth --
def _yoy(a: np.ndarray, months: int, back: int = 0) -> np.ndarray:
    """Log growth of the `months`-long window ending `back` months ago versus the same window a year earlier."""
    T = a.shape[-1]
    end = T - back
    now = a[..., end - months:end].sum(axis=-1)
    then = a[..., end - months - 12:end - 12].sum(axis=-1)
    return np.log((now + 1.0) / (then + 1.0))


def growth_rates(st: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Annual log growth per state x trade [G, O], a flag where the latest half-year broke trend,
    and the size of that change (latest half-year growth minus the half-year before)."""
    nat = st.sum(axis=0)
    g12, g6, g6p = _yoy(st, 12), _yoy(st, 6), _yoy(st, 6, back=6)
    n12, n6, n6p = _yoy(nat, 12), _yoy(nat, 6), _yoy(nat, 6, back=6)
    big = st[:, :, -12:].sum(axis=2) >= 150                                  # only trust breaks on real volume
    broke = big & (np.abs(g6 - g6p) > BREAK_PP)
    nat_g = np.where(np.abs(n6 - n6p) > BREAK_PP, n6, 0.5 * n6 + 0.5 * n12)
    own = np.where(broke, g6, 0.5 * g6 + 0.5 * g12)
    weight = np.where(broke, 0.8, 0.5)
    g = weight * own + (1 - weight) * nat_g[None]
    # A year-on-year rate this small cannot be told apart from noise, so it is pulled toward zero.
    return g * g ** 2 / (g ** 2 + GROWTH_NOISE ** 2), broke, g6 - g6p


# ---------------------------------------------------------------- leading --
def leading_adjust(fc: np.ndarray, est: np.ndarray, enterprise: np.ndarray, sector_of: np.ndarray) -> tuple[np.ndarray, list]:
    """Shift a district-sector's forecast when enterprise registrations break from the trend."""
    D, O, h = fc.shape
    out, notes = fc.copy(), []
    S = len(SECTORS)
    for s in range(S):
        m = sector_of == s
        now = enterprise[:, s, -6:].sum(axis=1)
        prev = enterprise[:, s, -12:-6].sum(axis=1)
        lead = (now + 1) / (prev + 1)                                         # forward half-year growth, per registrations
        last6 = est[:, m, -6:].sum(axis=(1, 2))
        next6 = fc[:, m, :6].sum(axis=(1, 2))
        model = (next6 + 1) / (last6 + 1)                                     # same quantity, per the trend model
        gap = np.log(lead / model)
        se = np.sqrt(1 / np.maximum(now, 1) + 1 / np.maximum(prev, 1) + 0.0075)
        hit = (np.abs(gap / se) > 2.5) & (now + prev >= 40)
        factor = np.exp(np.clip(0.8 * gap, np.log(0.7), np.log(1.6)))
        ramp = np.minimum(np.arange(1, h + 1), 6) / 6.0
        for d in np.where(hit)[0]:
            out[d][m, :] = fc[d][m, :] * factor[d] ** ramp[None, :]
            notes.append(dict(d=int(d), s=int(s), factor=float(factor[d]), z=float(gap[d] / se[d])))
    return out, notes


def pipeline_uplift(districts: pd.DataFrame, idx: pd.PeriodIndex, H: int, h: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Expected extra openings from announced projects: hiring starts 3 months before commissioning and
    runs 12 months, then settles at replacement hiring. Returns (expected, downside, upside)."""
    D, O = len(districts), len(TRADES)
    tid = {t["id"]: i for i, t in enumerate(TRADES)}
    did = {(s, r): i for i, (s, r) in enumerate(zip(districts["state"], districts["raw"]))}
    pos = {p: i for i, p in enumerate(idx)}
    exp_, lo, hi = np.zeros((D, O, h)), np.zeros((D, O, h)), np.zeros((D, O, h))
    for pr in PIPELINE:
        d = did[(pr["state"], pr["district"])]
        t0 = pos[pd.Period(pr["month"], freq="M")] - 3
        for j in range(h):
            t = H + j
            if t < t0:
                continue
            rate = 1 / 12 if t < t0 + 12 else 0.15 / 12
            for trade, jobs in pr["jobs"].items():
                o = tid[trade]
                exp_[d, o, j] += jobs * pr["p"] * rate
                lo[d, o, j] += jobs * pr["p"] * rate                 # could not materialise at all
                hi[d, o, j] += jobs * (1 - pr["p"]) * rate           # could materialise in full
    return exp_, lo, hi


# ------------------------------------------------------------------ driver --
def forecast_all(est: np.ndarray, enterprise: np.ndarray, districts: pd.DataFrame, idx: pd.PeriodIndex,
                 sidx: np.ndarray, sector_of: np.ndarray, h: int = 18,
                 leading: bool = False, pipeline: bool = True) -> dict:
    D, O, H = est.shape
    G = int(sidx.max()) + 1
    st = np.stack([est[sidx == g].sum(axis=0) for g in range(G)])            # [G, O, H]

    # state totals: same month last year x growth (seasonality carries over by construction)
    g_state, broke, accel = growth_rates(st)
    g_state = np.clip(g_state, np.log(0.55), np.log(2.6))
    fc_state = np.zeros((G, O, h))
    first = min(12, h)
    fc_state[:, :, :first] = st[:, :, H - 12:H - 12 + first] * np.exp(g_state)[:, :, None]
    if h > 12:                                                               # second year: growth damped
        fc_state[:, :, 12:] = fc_state[:, :, :h - 12] * np.exp(0.85 * g_state)[:, :, None]

    # district shares: share over the last year, drifting with the district's own relative growth
    size = est[:, :, -12:].sum(axis=2)
    rel = _yoy(est, 12) - _yoy(st, 12)[sidx]
    # only a large district that is clearly out-growing (or lagging) its state keeps part of that drift
    rho = np.where((size >= DRIFT_MIN_SIZE) & (np.abs(rel) >= DRIFT_MIN_REL), DRIFT_RHO, 0.0)
    steps = np.arange(1, h + 1)
    drift = (rel * rho / 12)[:, :, None] * np.cumsum(0.95 ** steps)[None, None, :]
    w = est[:, :, -SHARE_WINDOW:].sum(axis=2)[:, :, None] * np.exp(np.clip(drift, -0.6, 0.6))
    w_sum = np.stack([w[sidx == g].sum(axis=0) for g in range(G)])
    fc = fc_state[sidx] * w / np.maximum(w_sum[sidx], EPS)

    notes = []
    if leading:
        fc, notes = leading_adjust(fc, est, enterprise[:, :, :H], sector_of)
    up = lo = hi = np.zeros_like(fc)
    if pipeline:
        up, lo, hi = pipeline_uplift(districts, idx, H, h)
    return dict(fc=fc + up, base=fc, uplift=up, up_lo=lo, up_hi=hi, notes=notes, growth=g_state, broke=broke, accel=accel)


def annualised(hist: np.ndarray, fc: np.ndarray, hmon: int) -> np.ndarray:
    """12-month total ending `hmon` months into the forecast."""
    if hmon >= 12:
        return fc[:, :, hmon - 12:hmon].sum(axis=2)
    return hist[:, :, hist.shape[2] - (12 - hmon):].sum(axis=2) + fc[:, :, :hmon].sum(axis=2)


def _levels(a: np.ndarray, sidx: np.ndarray) -> dict:
    G = int(sidx.max()) + 1
    return dict(district=a, state=np.stack([a[sidx == g].sum(axis=0) for g in range(G)]), national=a.sum(axis=0))


def backtest(signals: dict, bench: dict, enterprise: np.ndarray, districts: pd.DataFrame, idx: pd.PeriodIndex,
             sidx: np.ndarray, sector_of: np.ndarray, est_final: np.ndarray, tilt: dict,
             origins=(30, 36, 42)) -> dict:
    """Rolling-origin evaluation. At each origin the index is rebuilt from the data available then.
    Baseline `naive` = next year looks like the last twelve months (how annual targets are set today)."""
    H = est_final.shape[2]
    levels = ("district", "state", "national")
    err = {v: {lv: {hz: [0.0, 0.0] for hz in HORIZONS} for lv in levels} for v in ("naive", "model")}
    groups = {k: {hz: [0.0, 0.0, 0.0] for hz in HORIZONS} for k in ("fast", "stable")}   # naive abs err, model abs err, actual
    lead = [0.0, 0.0, 0.0, 0]                                                # model abs err, with-lead abs err, actual, flags
    rel = {hz: [] for hz in HORIZONS}                                         # (forecast size, relative error) pairs
    rel_up = {lv: {hz: [] for hz in HORIZONS} for lv in ("state", "national")}
    for t0 in origins:
        est_o = build_index(signals, bench, districts, idx, sidx, sector_of, upto=t0, tilt=tilt)["est"]
        run = forecast_all(est_o, enterprise, districts, idx[:t0 + 18], sidx, sector_of, h=18, pipeline=False)
        with_lead = forecast_all(est_o, enterprise, districts, idx[:t0 + 18], sidx, sector_of, h=18, pipeline=False, leading=True)
        flagged = np.zeros(est_o.shape[:2], bool)
        for n in with_lead["notes"]:
            flagged[n["d"], sector_of == n["s"]] = True
        lead[3] += len(with_lead["notes"])
        yoy = np.abs(_yoy(est_o.sum(axis=0), 12))
        fast = np.broadcast_to((yoy >= 0.15)[None, :], est_o.shape[:2])
        for hz in HORIZONS:
            if t0 + hz > H:
                continue
            actual = est_final[:, :, t0 + hz - 12:t0 + hz].sum(axis=2)
            act_lv = _levels(actual, sidx)
            naive = est_o[:, :, -12:].sum(axis=2)
            model = annualised(est_o, run["fc"], hz)
            for v, pred in (("naive", naive), ("model", model)):
                for lv, pr in _levels(pred, sidx).items():
                    err[v][lv][hz][0] += float(np.abs(pr - act_lv[lv]).sum())
                    err[v][lv][hz][1] += float(act_lv[lv].sum())
            for k, m in (("fast", fast), ("stable", ~fast)):
                groups[k][hz][0] += float(np.abs(naive - actual)[m].sum())
                groups[k][hz][1] += float(np.abs(model - actual)[m].sum())
                groups[k][hz][2] += float(actual[m].sum())
            lead[0] += float(np.abs(model - actual)[flagged].sum())
            lead[1] += float(np.abs(annualised(est_o, with_lead["fc"], hz) - actual)[flagged].sum())
            lead[2] += float(actual[flagged].sum())
            rel[hz].append(np.stack([model.ravel(), ((actual - model) / np.maximum(model, 1.0)).ravel()]))
            mod_lv = _levels(model, sidx)
            for lv in ("state", "national"):
                rel_up[lv][hz].append(((act_lv[lv] - mod_lv[lv]) / np.maximum(mod_lv[lv], 1.0)).ravel())
    wape = {v: {lv: {hz: (e[0] / e[1] if e[1] else None) for hz, e in d.items()} for lv, d in lvls.items()}
            for v, lvls in err.items()}
    by_group = {k: {hz: dict(naive=e[0] / e[2], model=e[1] / e[2]) for hz, e in d.items() if e[2]} for k, d in groups.items()}

    # empirical uncertainty bands: 10th / 90th percentile of relative error by horizon and cell size
    bands = np.zeros((len(HORIZONS), len(SIZE_EDGES) + 1, 2))
    for i, hz in enumerate(HORIZONS):
        a = np.concatenate(rel[hz], axis=1)
        bucket = np.digitize(a[0], SIZE_EDGES)
        for b in range(len(SIZE_EDGES) + 1):
            v = a[1][bucket == b]
            bands[i, b] = np.percentile(v, [10, 90]) if v.size >= 30 else (-0.5, 0.6)
    bands_up = {lv: np.array([np.percentile(np.concatenate(rel_up[lv][hz]), [10, 90]) for hz in HORIZONS])
                for lv in ("state", "national")}
    return dict(wape=wape, by_group=by_group, bands=bands, bands_up=bands_up, origins=list(origins),
                lead_test=dict(without=lead[0] / max(lead[2], EPS), with_signal=lead[1] / max(lead[2], EPS), flags=lead[3]))


def band_for(annual_fc: np.ndarray, hmon: int, bands: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """80% interval for an annualised forecast `hmon` months out (linear in horizon between back-test points).
    `bands` is [horizon, size bucket, 2] for districts, or [horizon, 2] for state / national totals."""
    pts = np.array((0,) + HORIZONS, float)
    if bands.ndim == 2:
        lo_rel = np.interp(hmon, pts, np.concatenate([[0.0], bands[:, 0]]))
        hi_rel = np.interp(hmon, pts, np.concatenate([[0.0], bands[:, 1]]))
        return np.maximum(annual_fc * (1 + lo_rel), 0), annual_fc * (1 + hi_rel)
    bucket = np.digitize(annual_fc, SIZE_EDGES)
    lo_tab = np.concatenate([np.zeros((1, bands.shape[1])), bands[:, :, 0]], axis=0)
    hi_tab = np.concatenate([np.zeros((1, bands.shape[1])), bands[:, :, 1]], axis=0)
    lo_rel = np.stack([np.interp(hmon, pts, lo_tab[:, b]) for b in range(bands.shape[1])])[bucket]
    hi_rel = np.stack([np.interp(hmon, pts, hi_tab[:, b]) for b in range(bands.shape[1])])[bucket]
    return np.maximum(annual_fc * (1 + lo_rel), 0), annual_fc * (1 + hi_rel)


if __name__ == "__main__":
    import time
    from geo import load_districts
    from synth import generate
    t = time.time()
    d = load_districts()
    g = generate(d)
    r = build_index(g["signals"], g["bench"], d, g["idx"], g["sidx"], g["sector_of"],
                    anchor=(g["bench_district"], g["bench_district_fy"]))
    bt = backtest(g["signals"], g["bench"], g["enterprise"], d, g["idx"], g["sidx"], g["sector_of"], r["est"], r["tilt"])
    for v, lv in bt["wape"].items():
        print(f"{v:6s}", {k: {hz: (round(x, 3) if x is not None else None) for hz, x in e.items()} for k, e in lv.items()})
    print("by group:", {k: {hz: {a: round(b, 3) for a, b in e.items()} for hz, e in v.items()} for k, v in bt["by_group"].items()})
    print("lead-signal test:", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in bt["lead_test"].items()})
    print("bands (h x size x [p10, p90]):")
    print(np.round(bt["bands"], 2))
    f = forecast_all(r["est"], g["enterprise"], d, g["idx"], g["sidx"], g["sector_of"])
    print("breaks:", int(f["broke"].sum()), "| pipeline uplift (18 mo):", round(float(f["uplift"].sum())))
    print("FY28 demand forecast:", round(float(f["fc"][:, :, 6:18].sum())), "| last 12 mo:", round(float(r["est"][:, :, -12:].sum())))
    print(f"{time.time() - t:.1f}s")
