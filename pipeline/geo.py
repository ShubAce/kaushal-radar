"""District table: real boundaries + real Census 2011 population, scaled to 2026."""
from __future__ import annotations

import json
import re

import pandas as pd

from config import BUILD, MERGES, RAW, RENAME, SPLITS, STATES, URBAN_OVERRIDE

ST_BY_NAME = {v["name"]: k for k, v in STATES.items()}


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def load_districts() -> pd.DataFrame:
    topo = json.loads((RAW / "india.topo.json").read_text(encoding="utf-8"))
    census = pd.read_csv(RAW / "census2011_districts.csv")
    census = census.set_index("District code")

    def census_row(code: int) -> dict:
        r = census.loc[code]
        hh = max(float(r["Households"]), 1.0)
        return dict(
            pop=float(r["Population"]),
            urban=float(r["Urban_Households"]) / hh,
            nonfarm=float(r["Other_Workers"]) / max(float(r["Workers"]), 1.0),
            literacy=float(r["Literate"]) / max(float(r["Population"]), 1.0),
        )

    # Share of each parent district that stays with the parent after later splits.
    given_away: dict[int, float] = {}
    for parts in SPLITS.values():
        for code, share in parts:
            given_away[code] = given_away.get(code, 0.0) + share

    rows = []
    for g in topo["objects"]["districts"]["geometries"]:
        p = g["properties"]
        st = ST_BY_NAME.get(p["st_nm"])
        if st is None:
            continue
        raw = p["district"]
        key = (st, raw)
        if key in SPLITS:
            parts = [(census_row(code), share) for code, share in SPLITS[key]]
            pop = sum(c["pop"] * s for c, s in parts)
            w = [c["pop"] * s for c, s in parts]
            mix = lambda f: sum(c[f] * wi for (c, _), wi in zip(parts, w)) / sum(w)  # noqa: E731
            urban, nonfarm, literacy = mix("urban"), mix("nonfarm"), mix("literacy")
            basis = "Apportioned from Census 2011 parent district(s)"
        elif key in MERGES:
            parts = [census_row(code) for code in MERGES[key]]
            pop = sum(c["pop"] for c in parts)
            mixm = lambda f: sum(c[f] * c["pop"] for c in parts) / pop  # noqa: E731
            urban, nonfarm, literacy = mixm("urban"), mixm("nonfarm"), mixm("literacy")
            basis = "Census 2011 (merged)"
        else:
            code = int(p["dt_code"])
            c = census_row(code)
            keep = 1.0 - given_away.get(code, 0.0)
            pop, urban, nonfarm, literacy = c["pop"] * keep, c["urban"], c["nonfarm"], c["literacy"]
            basis = "Census 2011" if keep == 1.0 else "Census 2011 less areas carved out later"
        urban = URBAN_OVERRIDE.get(key, urban)
        name = RENAME.get(key, raw)
        meta = STATES[st]
        pop26 = pop * meta["growth"]
        rows.append(dict(
            id=f"{st.lower()}-{slug(name)}", name=name, raw=raw, state=st,
            code=str(p.get("dt_code") or ""), pop2011=round(pop), pop=round(pop26),
            wa=round(pop26 * meta["wa"]), urban=round(min(max(urban, 0.03), 1.0), 4),
            nonfarm=round(nonfarm, 4), literacy=round(literacy, 4), basis=basis,
        ))
    df = pd.DataFrame(rows).sort_values(["state", "name"]).reset_index(drop=True)
    assert df["id"].is_unique, "district ids must be unique"
    BUILD.mkdir(exist_ok=True)
    (BUILD / "districts.json").write_text(
        json.dumps(df[["id", "name", "raw", "state"]].to_dict("records"), ensure_ascii=False), encoding="utf-8")
    return df


if __name__ == "__main__":
    d = load_districts()
    print(d.groupby("state").agg(n=("id", "count"), pop=("pop", "sum"), wa=("wa", "sum")))
    print(d.sort_values("pop", ascending=False).head(12)[["id", "pop", "urban", "nonfarm"]])
