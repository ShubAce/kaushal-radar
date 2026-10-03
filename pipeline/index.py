"""Composite Demand Index.

Turns several partial, biased demand sources into one estimate of entry-level
openings per district x trade x month, in five documented steps:

  1. Clean      - damp one-off spikes (job fairs) in NCS vacancies.
  2. Calibrate  - estimate what share of true openings each source captures
                  (its coverage), by benchmarking against the annual labour
                  force survey at state x trade level. Divide by it.
  3. Correct    - remove each source's urban tilt (portals over-represent cities).
  4. Combine    - inverse-variance weighting, cell by cell: a source counts for
                  more where it has more coverage and less noise.
  5. Stabilise  - shrink thin cells toward the district's usual share of the
                  state total, then smooth lightly over three months.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import SECTORS, SHRINK_K, SOURCES, TRADES
from synth import fy_of

EPS = 1e-9
SRC = [s["id"] for s in SOURCES]
LAG = {s["id"]: s["lag"] for s in SOURCES}


def _despike(obs: np.ndarray) -> tuple[np.ndarray, int]:
    """Scale down district-months whose total is far above the local median."""
    tot = np.nansum(obs, axis=1)                                             # [D, H]
    med = pd.DataFrame(tot.T).rolling(13, center=True, min_periods=5).median().to_numpy().T
    factor = np.where((med > 0) & (tot > 1.8 * med), tot / np.maximum(med, EPS), 1.0)
    return obs / factor[:, None, :], int((factor > 1).sum())


def _pooled_slope(y: np.ndarray, x: np.ndarray, ok: np.ndarray, groups: np.ndarray, n_groups: int) -> np.ndarray:
    """OLS slope of y on x per sector, with a separate intercept for each trade."""
    out = np.zeros(n_groups)
    for g in range(n_groups):
        sxy = sxx = 0.0
        for o in np.where(groups == g)[0]:
            m = ok[:, o]
            if m.sum() < 8:
                continue
            xo, yo = x[m], y[m, o]
            xo, yo = xo - xo.mean(), yo - yo.mean()
            sxy += float((xo * yo).sum())
            sxx += float((xo * xo).sum())
        out[g] = sxy / sxx if sxx > 0 else 0.0
    return out


def build_index(signals: dict, bench: dict, districts: pd.DataFrame, idx: pd.PeriodIndex,
                sidx: np.ndarray, sector_of: np.ndarray, upto: int | None = None,
                anchor: tuple[np.ndarray, int] | None = None, tilt: dict | None = None) -> dict:
    """anchor = (district x sector survey totals, fiscal year) used to measure each source's
    urban tilt. At a past origin the survey is not out yet, so pass the fitted `tilt` instead."""
    H = upto or next(iter(signals.values())).shape[2]
    D, O = next(iter(signals.values())).shape[:2]
    G, S = int(sidx.max()) + 1, len(SECTORS)
    urban = districts["urban"].to_numpy(float)
    wa = districts["wa"].to_numpy(float)
    fys = np.array([fy_of(p) for p in idx[:H]])

    obs = {}
    for s in SRC:
        a = signals[s][:, :, :H].copy()
        if LAG[s] and upto:                       # emulate the publication delay at a past origin
            a[:, :, H - LAG[s]:] = np.nan
        obs[s] = a
    obs["ncs"], n_spikes = _despike(obs["ncs"])

    # --- 2. coverage from the survey benchmark (only years published by month H)
    fy_ok = [fy for fy in sorted(bench) if (np.where(fys == fy)[0].size == 12 and np.where(fys == fy)[0][-1] + 6 <= H - 1)]
    if not fy_ok:
        fy_ok = [min(bench)]
    mask_t = np.isin(fys, fy_ok)
    bench_sum = sum(bench[fy] for fy in fy_ok)                                    # [G, O]
    kappa = {}
    for s in SRC:
        seen = np.nansum(obs[s][:, :, mask_t], axis=2)                            # [D, O]
        by_state = np.stack([seen[sidx == g].sum(axis=0) for g in range(G)])     # [G, O]
        pooled = by_state.sum(axis=0) / np.maximum(bench_sum.sum(axis=0), EPS)   # [O]
        k = by_state / np.maximum(bench_sum, EPS)
        thin = bench_sum < 40                                                     # too few openings to calibrate on
        kappa[s] = np.clip(np.where(thin, pooled[None, :], k), 0.003, 1.5)

    x = {s: obs[s] / kappa[s][sidx][:, :, None] for s in SRC}                     # debiased estimates

    # --- 3. urban tilt of each source, measured against the district survey anchor
    logu = np.log(urban)
    if tilt is None:
        tilt = {}
        if anchor is not None:
            survey, afy = anchor                                                  # [D, S]
            m_fy = fys == afy
            for s in SRC:
                mine = np.stack([np.nansum(x[s][:, sector_of == g][:, :, m_fy], axis=(1, 2)) for g in range(S)], axis=1)
                seen = np.stack([np.nansum(obs[s][:, sector_of == g][:, :, m_fy], axis=(1, 2)) for g in range(S)], axis=1)
                ok = (seen >= 15) & (survey > 0) & (mine > 0)
                y = np.log(np.maximum(mine, EPS) / np.maximum(survey, EPS))
                eta = _pooled_slope(y, logu, ok, np.arange(S), S)
                tilt[s] = np.where(np.abs(eta) < 0.10, 0.0, eta)                   # ignore negligible tilts
        else:
            tilt = {s: np.zeros(S) for s in SRC}
    for s in SRC:
        eta = tilt[s]
        adj = np.exp(-eta[sector_of][None, :] * logu[:, None])                    # [D, O]
        before = np.stack([np.nansum(x[s][sidx == g], axis=(0, 2)) for g in range(G)])
        x[s] = x[s] * adj[:, :, None]
        after = np.stack([np.nansum(x[s][sidx == g], axis=(0, 2)) for g in range(G)])
        x[s] = x[s] * (before / np.maximum(after, EPS))[sidx][:, :, None]         # keep state totals on benchmark

    # --- 4. inverse-variance combination
    stack = np.stack([x[s] for s in SRC])                                          # [K, D, O, H]
    avail = ~np.isnan(stack)
    cons = np.nanmean(stack, axis=0)
    kap = np.stack([kappa[s][sidx] for s in SRC])[:, :, :, None]                   # [K, D, O, 1]
    sig2 = np.full((len(SRC), S), 0.1)
    for _ in range(3):
        for k, s in enumerate(SRC):
            big = (obs[s] >= 30) & (cons > 0) & avail[k]
            r = np.log(np.maximum(stack[k], EPS) / np.maximum(cons, EPS))
            for g in range(S):
                m = big[:, sector_of == g, :]
                if m.sum() < 50:
                    continue
                v = r[:, sector_of == g, :][m]
                mad = np.median(np.abs(v - np.median(v))) * 1.4826
                sig2[k, g] = float(np.clip(mad ** 2 - 1 / 45.0, 0.01, 1.0))        # less the Poisson share
        c = np.maximum(cons, 0.05)
        var = c[None] / kap + (c[None] ** 2) * sig2[:, sector_of][:, None, :, None]
        w = np.where(avail, 1.0 / var, 0.0)
        wsum = w.sum(axis=0)
        cons = np.where(wsum > 0, (w * np.nan_to_num(stack)).sum(axis=0) / np.maximum(wsum, EPS), 0.0)
    est_var = 1.0 / np.maximum(wsum, EPS)
    share_w = (w / np.maximum(wsum, EPS)[None])                                   # each source's share of the weight

    # --- 5. shrink thin cells, then smooth
    n_raw = np.nansum(np.stack([np.nan_to_num(obs[s]) for s in SRC]), axis=0)      # raw observations per cell-month
    n_smooth = pd.DataFrame(n_raw.reshape(D * O, H).T).rolling(3, center=True, min_periods=1).mean().to_numpy().T.reshape(D, O, H)
    B = n_smooth / (n_smooth + SHRINK_K)
    csum = np.cumsum(cons, axis=2)
    roll = csum.copy()
    roll[:, :, 12:] = csum[:, :, 12:] - csum[:, :, :-12]                            # trailing 12-month sum
    roll[:, :, :12] = csum[:, :, [min(11, H - 1)]]                                  # early months use the first year
    st_roll = np.stack([roll[sidx == g].sum(axis=0) for g in range(G)])            # [G, O, H]
    share = roll / np.maximum(st_roll[sidx], EPS)
    st_now = np.stack([cons[sidx == g].sum(axis=0) for g in range(G)])
    prior = share * st_now[sidx]
    shrunk = B * cons + (1 - B) * prior
    sm = shrunk.copy()
    if H >= 3:
        sm[:, :, 1:-1] = 0.25 * shrunk[:, :, :-2] + 0.5 * shrunk[:, :, 1:-1] + 0.25 * shrunk[:, :, 2:]
        sm[:, :, -1] = 0.34 * shrunk[:, :, -2] + 0.66 * shrunk[:, :, -1]
        sm[:, :, 0] = 0.66 * shrunk[:, :, 0] + 0.34 * shrunk[:, :, 1]
    rse = np.clip(np.sqrt(est_var) * 0.6 / np.maximum(sm, 0.5), 0, 3)

    # weight share by source x sector, weighted by cell size (for the methodology page)
    wshare = np.zeros((len(SRC), S))
    for g in range(S):
        m = sector_of == g
        tot = cons[:, m, :].sum()
        for k in range(len(SRC)):
            wshare[k, g] = float((share_w[k][:, m, :] * cons[:, m, :]).sum() / max(tot, EPS))

    return dict(
        est=sm, rse=rse, kappa=kappa, tilt=tilt, sigma=np.sqrt(sig2), wshare=wshare,
        n_raw=n_raw, x=x, obs=obs, fy_used=fy_ok, n_spikes=n_spikes,
        wcell=share_w[..., -12:].mean(axis=3),
        records={s: float(np.nansum(obs[s])) for s in SRC},
    )


def recovery_test(est: np.ndarray, x: dict, signals: dict, truth: np.ndarray, idx: pd.PeriodIndex, fy: int = 2026) -> dict:
    """Because the demo data is simulated, the hidden truth is known. Compare."""
    H = est.shape[2]
    m = np.array([fy_of(p) for p in idx[:H]]) == fy
    t = truth[:, :, :H][:, :, m].sum(axis=2)
    ours = est[:, :, m].sum(axis=2)
    portal = np.nansum(signals["portal"][:, :, :H][:, :, m], axis=2)
    portal_only = portal * (t.sum(axis=0) / np.maximum(portal.sum(axis=0), EPS))[None, :]     # scaled per trade
    simple = np.zeros_like(t)
    for s in SRC:
        a = np.nansum(signals[s][:, :, :H][:, :, m], axis=2)
        simple += a * (t.sum(axis=0) / np.maximum(a.sum(axis=0), EPS))[None, :]
    simple /= len(SRC)

    def wape(a):
        return float(np.abs(a - t).sum() / t.sum())

    def corr(a):
        ok = (t > 5)
        return float(np.corrcoef(np.log(a[ok] + 1), np.log(t[ok] + 1))[0, 1])

    return dict(
        fy=fy,
        ours=dict(wape=wape(ours), corr=corr(ours)),
        portal_only=dict(wape=wape(portal_only), corr=corr(portal_only)),
        simple_average=dict(wape=wape(simple), corr=corr(simple)),
        cells=int((t > 5).sum()),
    )


if __name__ == "__main__":
    from geo import load_districts
    from synth import generate
    d = load_districts()
    g = generate(d)
    r = build_index(g["signals"], g["bench"], d, g["idx"], g["sidx"], g["sector_of"],
                    anchor=(g["bench_district"], g["bench_district_fy"]))
    print("benchmark years used:", r["fy_used"], "| NCS spikes damped:", r["n_spikes"])
    print("urban tilt by source x sector:")
    for s in SRC:
        print(f"  {s:8s}", np.round(r["tilt"][s], 2))
    print("noise sd by source x sector:")
    for k, s in enumerate(SRC):
        print(f"  {s:8s}", np.round(r["sigma"][k], 2))
    print("weight share by source x sector:")
    for k, s in enumerate(SRC):
        print(f"  {s:8s}", np.round(r["wshare"][k], 2))
    print("mean coverage by source:", {s: round(float(r['kappa'][s].mean()), 3) for s in SRC})
    print("recovery:", recovery_test(r["est"], r["x"], g["signals"], g["truth"], g["idx"]))
