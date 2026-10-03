"""Source data as CSV files: the boundary between the pipeline and the outside world.

    python pipeline/run.py --export-inputs pipeline/inputs   write the demo data in this format
    python pipeline/run.py --inputs pipeline/inputs          run on the files in that folder

Required   demand_signals.csv, survey_benchmark.csv, seats.csv, training_funnel.csv
Optional   survey_district.csv, placement.csv, eshram.csv, enterprise_registrations.csv

Rules
  - The time window is fixed by START and N_HIST in config.py. Rows outside it are ignored.
  - District ids are the ones in data/geo.json; trade and sector ids are in data/taxonomy.json.
  - A missing row means zero, with one exception: months after a demand source's last
    reported month count as "not published yet", not as zero.
  - Duplicate rows are added together.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from config import FUNNEL, N_HIST, PLAN_FY, SECTORS, SOURCES, STATES, TRADES
from synth import fy_of, months

REQUIRED = {
    "demand_signals.csv": ["source", "district_id", "trade_id", "month", "count"],
    "survey_benchmark.csv": ["state", "trade_id", "fiscal_year", "openings"],
    "seats.csv": ["district_id", "trade_id", "fiscal_year", "seats"],
    "training_funnel.csv": ["district_id", "trade_id", "month", "enrolled", "certified", "entrants"],
}
OPTIONAL = {
    "survey_district.csv": ["district_id", "sector_id", "fiscal_year", "openings"],
    "placement.csv": ["district_id", "trade_id", "placement_rate"],
    "eshram.csv": ["district_id", "trade_id", "registered"],
    "enterprise_registrations.csv": ["district_id", "sector_id", "month", "registrations"],
}
SRC = [s["id"] for s in SOURCES]
TRADE_IDS = [t["id"] for t in TRADES]
SECTOR_IDS = [s["id"] for s in SECTORS]
ID_COLS = ("source", "district_id", "trade_id", "sector_id", "state", "month")


class InputError(ValueError):
    """The input files do not match the documented format."""


def layout(districts: pd.DataFrame) -> dict:
    """Indexing shared by every array: months, the state of each district, the sector of each trade."""
    idx = months()
    states = list(STATES)
    sidx = np.array([states.index(s) for s in districts["state"]])
    sector_of = np.array([SECTOR_IDS.index(t["sector"]) for t in TRADES])
    return dict(idx=idx, H=N_HIST, T=len(idx), states=states, sidx=sidx, sector_of=sector_of)


# ------------------------------------------------------------------ export --
def export_inputs(g: dict, districts: pd.DataFrame, folder: Path) -> dict:
    """Write the generated demo data in the input format. Returns rows written per file."""
    folder.mkdir(parents=True, exist_ok=True)
    H, idx = g["H"], g["idx"]
    ids = districts["id"].to_numpy()
    tids, secs, states = np.array(TRADE_IDS), np.array(SECTOR_IDS), np.array(g["states"])
    mon = np.array([str(p) for p in idx[:H]])
    rows = {}

    def save(name: str, df: pd.DataFrame, **kw) -> None:
        df.to_csv(folder / name, index=False, lineterminator="\n", **kw)
        rows[name] = len(df)

    parts = []
    for s in SRC:
        a = np.nan_to_num(g["signals"][s][:, :, :H])
        d, o, t = np.nonzero(a > 0)
        parts.append(pd.DataFrame(dict(source=s, district_id=ids[d], trade_id=tids[o], month=mon[t], count=a[d, o, t].astype(int))))
    save("demand_signals.csv", pd.concat(parts, ignore_index=True))

    parts = []
    for fy, a in sorted(g["bench"].items()):
        q, o = np.indices(a.shape)
        parts.append(pd.DataFrame(dict(state=states[q.ravel()], trade_id=tids[o.ravel()], fiscal_year=fy, openings=a.ravel())))
    save("survey_benchmark.csv", pd.concat(parts, ignore_index=True), float_format="%.3f")

    d, s = np.indices(g["bench_district"].shape)
    save("survey_district.csv", pd.DataFrame(dict(district_id=ids[d.ravel()], sector_id=secs[s.ravel()],
         fiscal_year=g["bench_district_fy"], openings=g["bench_district"].ravel())), float_format="%.3f")

    first_fy = fy_of(idx[0])
    parts = []
    for j, fy in enumerate(g["fy_list"]):
        if fy < first_fy:
            continue
        a = g["seats"][:, :, j]
        d, o = np.nonzero(a > 0)
        parts.append(pd.DataFrame(dict(district_id=ids[d], trade_id=tids[o], fiscal_year=fy, seats=a[d, o].astype(int))))
    save("seats.csv", pd.concat(parts, ignore_index=True))

    enr, cert, ent = g["enrolled"][:, :, :H], g["certified"][:, :, :H], g["supply"][:, :, :H]
    d, o, t = np.nonzero((enr > 0) | (cert > 0) | (ent > 0))
    save("training_funnel.csv", pd.DataFrame(dict(district_id=ids[d], trade_id=tids[o], month=mon[t], enrolled=enr[d, o, t],
         certified=cert[d, o, t], entrants=ent[d, o, t])), float_format="%.6f")

    d, o = np.nonzero(~np.isnan(g["placement"]))
    save("placement.csv", pd.DataFrame(dict(district_id=ids[d], trade_id=tids[o], placement_rate=g["placement"][d, o])), float_format="%.6f")

    d, o = np.nonzero(g["eshram"] > 0)
    save("eshram.csv", pd.DataFrame(dict(district_id=ids[d], trade_id=tids[o], registered=g["eshram"][d, o].astype(int))))

    a = g["enterprise"][:, :, :H]
    d, s, t = np.nonzero(a > 0)
    save("enterprise_registrations.csv", pd.DataFrame(dict(district_id=ids[d], sector_id=secs[s], month=mon[t],
         registrations=a[d, s, t].astype(int))))
    return rows


# -------------------------------------------------------------------- read --
def _read(folder: Path, name: str, cols: list[str]) -> pd.DataFrame:
    df = pd.read_csv(folder / name, dtype={c: str for c in ID_COLS if c in cols})
    df.columns = [c.strip() for c in df.columns]
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise InputError(f"{name}: missing column(s) {', '.join(missing)}. Expected: {', '.join(cols)}")
    for c in cols:
        if c in ID_COLS:
            df[c] = df[c].str.strip()
        else:
            num = pd.to_numeric(df[c], errors="coerce")
            if num.isna().any():
                raise InputError(f"{name}: column '{c}' has {int(num.isna().sum())} value(s) that are not numbers")
            if (num < 0).any():
                raise InputError(f"{name}: column '{c}' has negative values")
            df[c] = num
    return df[cols]


def _code(df: pd.DataFrame, col: str, ids: list[str], name: str) -> np.ndarray:
    pos = pd.Series(np.arange(len(ids)), index=ids)
    out = df[col].map(pos)
    if out.isna().any():
        bad = sorted(df.loc[out.isna(), col].dropna().unique())[:5]
        raise InputError(f"{name}: unknown {col} value(s): {', '.join(map(str, bad)) or '(blank)'}")
    return out.to_numpy(int)


def _in_window(df: pd.DataFrame, mon: list[str], name: str, notes: list[str]) -> tuple[pd.DataFrame, np.ndarray]:
    pos = pd.Series(np.arange(len(mon)), index=mon)
    t = df["month"].map(pos)
    if t.isna().any():
        notes.append(f"{name}: ignored {int(t.isna().sum()):,} row(s) outside {mon[0]} to {mon[-1]}")
        df, t = df[t.notna()], t[t.notna()]
    if df.empty:
        raise InputError(f"{name}: no rows between {mon[0]} and {mon[-1]} (months must look like 2026-09)")
    return df, t.to_numpy(int)


def _fill(shape: tuple, where: tuple, values: np.ndarray) -> np.ndarray:
    a = np.zeros(shape)
    np.add.at(a, where, values)
    return a


# ----------------------------------------------------------------- project --
def project_supply(seats: np.ndarray, fy_list: list[int], enrolled: np.ndarray, certified: np.ndarray,
                   entrants: np.ndarray, idx: pd.PeriodIndex, H: int) -> dict:
    """Carry the training funnel into the forecast months.

    Future entrants come from trainees already enrolled and from seats already sanctioned.
    The rates are measured from the funnel history, per trade: the share of enrolments
    certified `duration + 1` months later, the share of the certified who look for work, and
    the calendar of intake. Utilisation is measured per district x trade from the latest
    full fiscal year.
    """
    D, O, T = seats.shape[0], seats.shape[1], len(idx)
    fys = np.array([fy_of(p) for p in idx])
    moy = np.array([p.month - 1 for p in idx])
    full = [fy for fy in sorted(set(fys[:H])) if (fys[:H] == fy).sum() == 12 and fy in fy_list]
    if not full:
        raise InputError("training_funnel.csv and seats.csv must share at least one complete fiscal year")
    last = full[-1]
    in_full = np.isin(fys[:H], full)
    enr = np.concatenate([enrolled, np.zeros((D, O, T - H))], axis=2)
    cert = np.concatenate([certified, np.zeros((D, O, T - H))], axis=2)
    ent = np.concatenate([entrants, np.zeros((D, O, T - H))], axis=2)
    util, yield_ = np.zeros((D, O)), np.zeros(O)
    for o, tr in enumerate(TRADES):
        f = FUNNEL[tr["kind"]]
        done = tr["dur"] + 1                                               # one month for assessment
        by_moy = np.array([enrolled[:, o, :][:, in_full & (moy[:H] == k)].sum() for k in range(12)])
        w = by_moy / by_moy.sum() if by_moy.sum() > 0 else np.full(12, 1 / 12)
        seats_last = seats[:, o, fy_list.index(last)]
        enr_last = enrolled[:, o, fys[:H] == last].sum(axis=1)
        pooled = enr_last.sum() / seats_last.sum() if seats_last.sum() > 0 else f["util"]
        util[:, o] = np.clip(np.where(seats_last > 0, enr_last / np.maximum(seats_last, 1), pooled), 0.3, 1.0)
        base = enrolled[:, o, :H - done].sum()
        passed = certified[:, o, done:].sum() / base if base > 0 else f["complete"] * f["certify"]
        entry = entrants[:, o, :].sum() / certified[:, o, :].sum() if certified[:, o, :].sum() > 0 else f["entry"]
        for t in range(H, T):
            if fys[t] not in fy_list:
                raise InputError(f"seats.csv: fiscal year {fys[t]} is needed for the forecast months")
            enr[:, o, t] = seats[:, o, fy_list.index(fys[t])] * w[moy[t]] * util[:, o]
        for t in range(H, T):
            cert[:, o, t] = enr[:, o, t - done] * passed if t - done >= 0 else 0.0
            ent[:, o, t] = cert[:, o, t] * entry
        yield_[o] = float(np.average(util[:, o], weights=seats_last) if seats_last.sum() > 0 else pooled) * passed * entry
    return dict(supply=ent, certified=cert, enrolled=enr, util=util, yield_=yield_)


# -------------------------------------------------------------------- load --
def load_inputs(folder: Path, districts: pd.DataFrame) -> dict:
    """Read the CSV files and return the same structure synth.generate() does (without the hidden truth)."""
    if not folder.is_dir():
        raise InputError(f"input folder not found: {folder}")
    absent = [n for n in REQUIRED if not (folder / n).exists()]
    if absent:
        raise InputError(f"missing required file(s) in {folder}: {', '.join(absent)}")
    lay = layout(districts)
    idx, H, T, states, sidx = lay["idx"], lay["H"], lay["T"], lay["states"], lay["sidx"]
    D, O, G, S = len(districts), len(TRADES), len(states), len(SECTORS)
    ids = districts["id"].tolist()
    mon = [str(p) for p in idx[:H]]
    notes, files = [], []

    # demand signals
    name = "demand_signals.csv"
    df = _read(folder, name, REQUIRED[name])
    df, t = _in_window(df, mon, name, notes)
    k, d, o = _code(df, "source", SRC, name), _code(df, "district_id", ids, name), _code(df, "trade_id", TRADE_IDS, name)
    cube = _fill((len(SRC), D, O, H), (k, d, o, t), df["count"].to_numpy(float))
    signals = {}
    for j, s in enumerate(SRC):
        seen = np.where(cube[j].sum(axis=(0, 1)) > 0)[0]
        if seen.size == 0:
            raise InputError(f"{name}: no rows for source '{s}'")
        a = cube[j].copy()
        a[:, :, seen[-1] + 1:] = np.nan                                     # not published yet
        if seen[-1] < H - 1:
            notes.append(f"{name}: source '{s}' ends {mon[seen[-1]]}; later months treated as not yet published")
        signals[s] = a
    files.append(name)

    # survey benchmark, state x trade x fiscal year
    name = "survey_benchmark.csv"
    df = _read(folder, name, REQUIRED[name])
    q, o = _code(df, "state", states, name), _code(df, "trade_id", TRADE_IDS, name)
    fy = df["fiscal_year"].to_numpy(int)
    bench = {int(y): _fill((G, O), (q[fy == y], o[fy == y]), df["openings"].to_numpy(float)[fy == y]) for y in sorted(set(fy))}
    files.append(name)

    # seats, district x trade x fiscal year
    name = "seats.csv"
    df = _read(folder, name, REQUIRED[name])
    fy = df["fiscal_year"].to_numpy(int)
    fy_list = sorted(int(y) for y in set(fy))
    need = [y for y in range(2025, PLAN_FY + 1) if y not in fy_list]
    if need:
        raise InputError(f"{name}: fiscal year(s) {', '.join(map(str, need))} are required (labelled by ending year, 2028 = 2027-28)")
    d, o = _code(df, "district_id", ids, name), _code(df, "trade_id", TRADE_IDS, name)
    seats = _fill((D, O, len(fy_list)), (d, o, np.searchsorted(fy_list, fy)), df["seats"].to_numpy(float))
    files.append(name)

    # training funnel, monthly
    name = "training_funnel.csv"
    df = _read(folder, name, REQUIRED[name])
    df, t = _in_window(df, mon, name, notes)
    d, o = _code(df, "district_id", ids, name), _code(df, "trade_id", TRADE_IDS, name)
    funnel = {c: _fill((D, O, H), (d, o, t), df[c].to_numpy(float)) for c in ("enrolled", "certified", "entrants")}
    proj = project_supply(seats, fy_list, funnel["enrolled"], funnel["certified"], funnel["entrants"], idx, H)
    files.append(name)

    # optional files
    bench_district, bench_district_fy = None, None
    name = "survey_district.csv"
    if (folder / name).exists():
        df = _read(folder, name, OPTIONAL[name])
        bench_district_fy = int(df["fiscal_year"].max())
        df = df[df["fiscal_year"] == bench_district_fy]
        bench_district = _fill((D, S), (_code(df, "district_id", ids, name), _code(df, "sector_id", SECTOR_IDS, name)),
                               df["openings"].to_numpy(float))
        files.append(name)
    else:
        notes.append(f"{name} not supplied: sources are not corrected for urban tilt")

    placement = np.full((D, O), np.nan)
    name = "placement.csv"
    if (folder / name).exists():
        df = _read(folder, name, OPTIONAL[name])
        if (df["placement_rate"] > 1).any():
            raise InputError(f"{name}: placement_rate must be between 0 and 1")
        placement[_code(df, "district_id", ids, name), _code(df, "trade_id", TRADE_IDS, name)] = df["placement_rate"].to_numpy(float)
        files.append(name)
    else:
        notes.append(f"{name} not supplied: the placement check is skipped")

    eshram = np.zeros((D, O))
    name = "eshram.csv"
    if (folder / name).exists():
        df = _read(folder, name, OPTIONAL[name])
        eshram = _fill((D, O), (_code(df, "district_id", ids, name), _code(df, "trade_id", TRADE_IDS, name)), df["registered"].to_numpy(float))
        files.append(name)

    enterprise = np.zeros((D, S, H))
    name = "enterprise_registrations.csv"
    has_enterprise = (folder / name).exists()
    if has_enterprise:
        df = _read(folder, name, OPTIONAL[name])
        df, t = _in_window(df, mon, name, notes)
        enterprise = _fill((D, S, H), (_code(df, "district_id", ids, name), _code(df, "sector_id", SECTOR_IDS, name), t),
                           df["registrations"].to_numpy(float))
        files.append(name)

    return dict(
        idx=idx, H=H, T=T, states=states, sidx=sidx, sector_of=lay["sector_of"], fy_list=fy_list,
        truth=None, signals=signals, bench=bench, bench_district=bench_district, bench_district_fy=bench_district_fy,
        enterprise=enterprise, has_enterprise=has_enterprise, seats=seats, util=proj["util"], yield_=proj["yield_"],
        supply=proj["supply"], certified=proj["certified"], enrolled=proj["enrolled"], placement=placement, eshram=eshram,
        quality=None, files=files, notes=notes,
    )
