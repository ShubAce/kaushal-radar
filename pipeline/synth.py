"""Synthetic source data for the demo.

The generator plays the role of the real world: it holds a hidden "true" demand
for every district x trade x month, then lets each data source observe it the
way the real source would - partially, with its own bias, noise and delay.
The pipeline never sees the truth; it only sees what the sources report.
That lets us test, at the end, how well the index recovers the hidden truth.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import (EXPORT_SHOCK, EXPORT_SHOCK_TRADES, FLOOR, FUNNEL, HUBS, ITI_UTIL, N_FUT, N_HIST,
                    PAST_EVENTS, SEASON, SECTORS, SEED, SOURCES, START, STATES, TRADES)

PRE = 36  # months of training intake generated before START, so early cohorts can graduate


def months() -> pd.PeriodIndex:
    return pd.period_range(START, periods=N_HIST + N_FUT, freq="M")


def fy_of(p: pd.Period) -> int:
    """Indian fiscal year, labelled by its ending year (Apr 2024 - Mar 2025 -> 2025)."""
    return p.year + 1 if p.month >= 4 else p.year


def wmean(x: np.ndarray, w: np.ndarray) -> float:
    return float((x * w).sum() / w.sum())


def hub_raw(districts: pd.DataFrame, key: str) -> np.ndarray:
    table, floor = HUBS[key], FLOOR[key]
    return np.array([table.get(s, {}).get(r, floor) for s, r in zip(districts["state"], districts["raw"])], dtype=float)


def demand_shape(districts: pd.DataFrame, tr: dict) -> np.ndarray:
    """Relative demand intensity per district for one trade; WA-weighted mean is 1."""
    wa = districts["wa"].to_numpy(float)
    raw = hub_raw(districts, tr["hub"]) ** tr["hubp"]
    blended = (1 - tr["conc"]) + tr["conc"] * raw / wmean(raw, wa)
    urban = districts["urban"].to_numpy(float)
    u = (urban / wmean(urban, wa)) ** tr["urb"]
    shape = blended * u
    return shape / wmean(shape, wa)


def growth_path(tr: dict, idx: pd.PeriodIndex) -> np.ndarray:
    """Demand level over time relative to Oct 2024 (the middle of the base year)."""
    g = tr["g"]
    monthly = np.empty(len(idx))
    if isinstance(g, tuple):
        g1, switch, g2 = g
        sw = pd.Period(switch, freq="M")
        monthly[:] = [np.log1p(g1) / 12 if p < sw else np.log1p(g2) / 12 for p in idx]
    else:
        monthly[:] = np.log1p(g) / 12
    level = np.exp(np.cumsum(monthly))
    base = list(idx).index(pd.Period("2024-10", freq="M"))
    return level / level[base]


def generate(districts: pd.DataFrame) -> dict:
    rng = np.random.default_rng(SEED)
    idx = months()
    T, D, O = len(idx), len(districts), len(TRADES)
    wa = districts["wa"].to_numpy(float)
    urban = districts["urban"].to_numpy(float)
    state = districts["state"].to_numpy()
    states = list(STATES)
    sidx = np.array([states.index(s) for s in state])
    moy = np.array([p.month - 1 for p in idx])
    sector_of = np.array([[s["id"] for s in SECTORS].index(t["sector"]) for t in TRADES])

    # ------------------------------------------------------- hidden true demand
    lam = np.zeros((D, O, T))
    dist_re = np.exp(rng.normal(0, 0.18, (D, O)))                       # persistent local differences
    dist_rw = np.exp(np.cumsum(rng.normal(0, 0.012, (D, O, T)), axis=2))  # slow local drift
    for o, tr in enumerate(TRADES):
        shape = demand_shape(districts, tr)
        season = np.array(SEASON[tr["seas"]], float)
        season = season / season.mean()
        common = np.exp(np.cumsum(rng.normal(0, 0.010, T)))               # trade-wide shocks
        st_dev = np.exp(np.cumsum(rng.normal(0, 0.008, (len(states), T)), axis=1))
        level = growth_path(tr, idx) * common
        base = wa / 1e5 * tr["b"] / 12.0                                    # openings per month
        lam[:, o, :] = (base * shape * dist_re[:, o])[:, None] * level[None, :] * st_dev[sidx, :] \
            * season[moy][None, :] * dist_rw[:, o, :]

    tid = {t["id"]: i for i, t in enumerate(TRADES)}
    did = {(s, r): i for i, (s, r) in enumerate(zip(districts["state"], districts["raw"]))}
    pos = {p: i for i, p in enumerate(idx)}
    for st, dn, trades, start, ramp, mult, _label in PAST_EVENTS:
        t0 = pos[pd.Period(start, freq="M")]
        k = np.clip((np.arange(T) - t0) / ramp, 0, 1)
        for t in trades:
            lam[did[(st, dn)], tid[t], :] *= 1 + (mult - 1) * k
    a, b, c = pos[pd.Period("2025-08", freq="M")], pos[pd.Period("2026-01", freq="M")], pos[pd.Period("2026-04", freq="M")]
    window = np.zeros(T)
    window[a:b + 1] = 1
    window[b + 1:c + 1] = np.linspace(1, 0, c - b + 1)[1:] if c > b else 0
    for (st, dn), depth in EXPORT_SHOCK.items():
        for t in EXPORT_SHOCK_TRADES:
            lam[did[(st, dn)], tid[t], :] *= 1 - depth * window

    H = N_HIST
    lam_h = lam[:, :, :H]

    # -------------------------------------------------- what each source sees
    online = np.array([t["online"] for t in TRADES])
    formal = np.array([t["formal"] for t in TRADES])
    naps = np.array([t["naps"] for t in TRADES])
    sector_ncs = {"ELEC": 1.2, "AUTO": 1.25, "GREEN": 0.9, "CONS": 0.5, "TEXT": 1.1, "IT": 0.6, "RETL": 1.2, "HLTH": 0.9, "LOGI": 1.0}
    ncs_base = np.array([0.075 * sector_ncs[t["sector"]] for t in TRADES])
    # Model Career Centres raise NCS coverage; bigger districts are likelier to have one.
    p_mcc = np.clip(0.25 + 0.5 * (wa / np.percentile(wa, 90)), 0.2, 0.9)
    mcc = rng.random(D) < p_mcc

    kappa = {
        "portal": np.clip(online[None, :] * np.clip((urban[:, None] / 0.45) ** 0.6, 0.25, 1.6), 0.005, 0.95),
        "ncs": ncs_base[None, :] * np.where(mcc, 1.7, 0.75)[:, None],
        "payroll": np.broadcast_to(formal[None, :] * 0.85, (D, O)).copy(),
        "naps": naps[None, :] * np.exp(rng.normal(0, 0.25, (D, 1))),
    }
    noise = {s["id"]: s["noise"] for s in SOURCES}
    signals, dup_rate = {}, {}
    for sid, k in kappa.items():
        mean = lam_h * k[:, :, None] * np.exp(rng.normal(0, noise[sid], (D, O, H)))
        obs = rng.poisson(mean).astype(float)
        if sid == "ncs":  # job fairs produce one-month spikes across a district
            fair = rng.random((D, H)) < 0.04
            obs *= np.where(fair, rng.uniform(2.0, 5.0, (D, H)), 1.0)[:, None, :]
            obs = np.round(obs)
        signals[sid] = obs
    signals["payroll"][:, :, H - 2:] = np.nan          # payroll data arrives two months late
    # Raw portal volume before de-duplication, for the data-quality panel.
    dup_rate["portal"] = 0.23
    raw_portal_postings = float(np.nansum(signals["portal"]) / (1 - dup_rate["portal"]))

    # Annual benchmark from the labour force survey: state x trade, with survey error.
    fys = np.array([fy_of(p) for p in idx[:H]])
    bench = {}
    for fy in (2024, 2025, 2026):
        m = fys == fy
        tot = np.stack([lam_h[sidx == g][:, :, m].sum(axis=(0, 2)) for g in range(len(states))])  # [G, O]
        bench[fy] = tot * np.exp(rng.normal(0, 0.05, tot.shape))

    # Leading indicator: enterprise registrations track sector demand six months ahead.
    S = len(SECTORS)
    sector_dem = np.stack([lam[:, sector_of == s, :].sum(axis=1) for s in range(S)], axis=1)  # [D, S, T]
    # District-level survey anchor (possible since the 2025 survey redesign made the district the
    # basic stratum): unbiased but noisy, and only for broad sectors.
    bench_district = sector_dem[:, :, :H][:, :, fys == 2026].sum(axis=2) * np.exp(rng.normal(0, 0.30, (D, S)))
    lead = 6
    enterprise = rng.poisson(0.22 * sector_dem[:, :, lead:lead + H] * np.exp(rng.normal(0, 0.15, (D, S, H)))).astype(float)

    # ---------------------------------------------------------------- supply
    long_idx = pd.period_range(idx[0] - PRE, periods=PRE + T, freq="M")
    LT = len(long_idx)
    long_fy = np.array([fy_of(p) for p in long_idx])
    long_moy = np.array([p.month - 1 for p in long_idx])
    fy_list = sorted(set(long_fy))
    stt_w = np.array([0.08, 0.08, 0.08, 0.05, 0.07, 0.08, 0.09, 0.09, 0.09, 0.09, 0.10, 0.10])  # Jan..Dec
    iti_w = np.zeros(12)
    iti_w[7], iti_w[8] = 0.6, 0.4                                                            # Aug, Sep
    state_supply = np.array([STATES[s]["supply"] for s in state])

    seats = np.zeros((D, O, len(fy_list)))
    util = np.zeros((D, O))
    yield_ = np.zeros(O)
    intake = np.zeros((D, O, LT))
    entrants = np.zeros((D, O, LT))
    certified = np.zeros((D, O, LT))
    enrolled = np.zeros((D, O, LT))
    for o, tr in enumerate(TRADES):
        f = FUNNEL[tr["kind"]]
        u_mean = ITI_UTIL.get(tr["id"], f["util"])
        y = u_mean * f["complete"] * f["certify"] * f["entry"]
        yield_[o] = y
        s_rate = tr["ratio"] * tr["b"] / y                              # seats per 100k working-age, base year
        raw = hub_raw(districts, tr["hub"])
        rel = raw / wmean(raw, wa)
        present = rng.random(D) < np.clip(tr["pres"] * (0.6 + 0.9 * np.sqrt(rel)), 0.02, 0.98)
        inst = np.exp(rng.normal(0, 0.45, D)) * (urban / wmean(urban, wa)) ** 0.25 * rel ** 0.22 * state_supply * present
        if inst.sum() == 0:
            inst[np.argmax(rel)] = 1.0
        inst = inst / wmean(inst, wa)
        base = wa / 1e5 * s_rate * inst
        drift = np.exp(np.cumsum(rng.normal(0, 0.06, (D, len(fy_list))), axis=1))
        drift = drift / drift[:, [fy_list.index(2025)]]
        for j, fy in enumerate(fy_list):
            seats[:, o, j] = np.round(base * (1 + tr["sg"]) ** (fy - 2025) * drift[:, j])
        util[:, o] = np.clip(rng.normal(u_mean, 0.07, D), 0.3, 1.0)
        w = (iti_w if tr["kind"] == "ITI" else stt_w)
        w = w / w.sum()
        fy_pos = np.array([fy_list.index(v) for v in long_fy])
        monthly = seats[:, o, :][:, fy_pos] * w[long_moy][None, :] * util[:, [o]]
        enrolled[:, o, :] = monthly
        done = tr["dur"] + 1                                               # one month for assessment
        cert = np.zeros((D, LT))
        cert[:, done:] = monthly[:, :-done] * f["complete"] * f["certify"]
        certified[:, o, :] = cert
        entrants[:, o, :] = cert * f["entry"]
        intake[:, o, :] = seats[:, o, :][:, fy_pos] * w[long_moy][None, :]
        ref = seats[:, o, fy_list.index(2026)]                              # realised seat-to-entrant yield
        if ref.sum() > 0:
            yield_[o] = float(np.average(util[:, o], weights=ref)) * f["complete"] * f["certify"] * f["entry"]

    sl = slice(PRE, PRE + T)
    supply = entrants[:, :, sl]            # labour-market entrants per month, history + committed pipeline
    cert_m = certified[:, :, sl]
    enr_m = enrolled[:, :, sl]

    # Observed placement of the FY 2025-26 certified cohort depends on the true local balance.
    m26 = fys == 2026
    d26 = lam_h[:, :, m26].sum(axis=2)
    s26 = supply[:, :, :H][:, :, m26].sum(axis=2)
    base_place = np.array([0.78 if t["kind"] == "STT" else 0.72 for t in TRADES])
    balance = np.clip((d26 + 1) / (s26 + 1), 0, 1) ** 0.8
    placement = np.clip(base_place[None, :] * balance * np.exp(rng.normal(0, 0.12, (D, O))), 0.02, 0.95)
    placement = np.where(s26 > 0, placement, np.nan)

    # e-Shram: stock of registered informal workers in the occupation (context, not demand).
    eshram = np.round(lam_h[:, :, -12:].sum(axis=2) * (1 - formal[None, :]) * rng.uniform(9, 16, (D, O)))

    return dict(
        idx=idx, H=H, T=T, states=states, sidx=sidx, sector_of=sector_of, fy_list=fy_list,
        truth=lam, signals=signals, kappa_true=kappa, bench=bench, bench_district=bench_district,
        bench_district_fy=2026, enterprise=enterprise,
        seats=seats, util=util, yield_=yield_, supply=supply, certified=cert_m, enrolled=enr_m,
        placement=placement, eshram=eshram, mcc=mcc,
        quality=dict(portal_raw_postings=raw_portal_postings, portal_dup_rate=dup_rate["portal"]),
    )


if __name__ == "__main__":
    from geo import load_districts
    d = load_districts()
    g = generate(d)
    H = g["H"]
    fys = np.array([fy_of(p) for p in g["idx"][:H]])
    m = fys == 2026
    dem = g["truth"][:, :, :H][:, :, m].sum(axis=(0, 2))
    sup = g["supply"][:, :, :H][:, :, m].sum(axis=(0, 2))
    j = g["fy_list"].index(2026)
    print(f"FY26 total demand {dem.sum():,.0f}  supply {sup.sum():,.0f}  seats {g['seats'][:, :, j].sum():,.0f}")
    for t, a, b in zip(TRADES, dem, sup):
        print(f"{t['id']:20s} D={a:9,.0f} S={b:9,.0f} S/D={b / a:5.2f}")
