# Methodology

How Kaushal Radar turns several partial data sources into one demand index, a forecast, early-warning flags and a seat plan. Everything described here is implemented in `pipeline/` and every number quoted is written by `pipeline/run.py` into `data/method.json`.

All results below come from simulated source data (see the README). They show that the method works under realistic bias, noise and delay. They are not a claim about accuracy on real feeds.

## 1. What is measured

| Term | Definition |
| --- | --- |
| Demand `D` | Entry-level openings a year that a certified trainee of that trade could fill, per district and trade |
| Supply `S` | Certified candidates entering the labour market a year, per district and trade |
| Cell | One district × one trade (181 × 40 in the pilot) |
| Now | The last 12 months of data |
| Planning year | The next training cycle, FY 2027-28 |

Common keys: district id, NCO-2015 occupation family, NSQF level, sector. Every source is mapped to these before anything else happens; the job-ad mapper in the app shows that step for a single posting.

## 2. Composite Demand Index

No source sees the whole market. Job portals over-count office jobs in cities, payroll records miss informal hiring, NCS depends on whether a district has an active career centre. The index estimates how much each source sees, corrects for it, and combines them. Code: `pipeline/index.py`.

**Step 1. Clean.** A district-month of NCS vacancies more than 1.8 times its 13-month local median is scaled back to the median (job fairs). 480 district-months were adjusted.

**Step 2. Calibrate coverage.** For each source, state and trade:

```
coverage = records seen by the source ÷ openings in the labour force survey benchmark
```

over the survey years already published. Where the benchmark is under 40 openings, the all-state coverage for that trade is used. Each source is divided by its coverage, which puts all four on the same scale. Measured mean coverage: portals 27%, NCS 10%, payroll 40%, apprenticeship 11%.

**Step 3. Correct urban tilt.** Since the 2025 PLFS redesign the district is the basic sampling stratum, so a district-level anchor exists for broad sectors. For each source and sector we regress `log(source estimate ÷ survey estimate)` on `log(urban share)` across districts. The slope is the source's urban tilt; slopes under 0.10 are treated as zero. Estimates are multiplied by `urban share ^ −tilt` and rescaled so state totals stay on the benchmark. Portals lean urban in every sector (tilt 0.31 to 0.62). The other sources show no tilt in most sectors and a mild rural lean (−0.1 to −0.4) in a few.

**Step 4. Combine by reliability.** Cell by cell and month by month, sources are averaged with inverse-variance weights:

```
variance = c ÷ coverage + c² × σ²
```

where `c` is the consensus estimate and `σ` is the source's noise in that sector, measured from how far the source strays from the consensus in well-observed cells. More coverage and less noise earn more weight. Payroll ends up with 36% to 53% of the weight depending on sector; portals lead in IT and logistics.

**Step 5. Stabilise thin cells.** A cell with few records borrows from its district's usual share of the state total:

```
estimate = B × own + (1 − B) × (usual share × state total),   B = n ÷ (n + 8)
```

with `n` the records behind the cell (three-month average). A light three-month smoothing follows.

**The index number shown in the product** is demand per working-age person, relative to the pilot-wide rate for that trade in FY 2024-25, times 100. An index of 145 means 45% more openings per person than that base.

### Does it recover true demand?

Because the demo data is simulated, the hidden true demand is known. District-level error (weighted absolute percentage error of annual openings, 6,534 cells):

| Method | Error | Correlation with truth |
| --- | --- | --- |
| Composite Demand Index | 10.4% | 0.98 |
| Simple average of the four sources | 15.6% | 0.96 |
| Job postings alone | 34.0% | 0.84 |

A second check needs no hidden truth and works on real data: where the index says supply exceeds demand, placement should be lower. Rank correlation between the index-implied balance and observed placement is 0.84 across 4,475 cells.

## 3. Forecast

District series are too noisy to carry their own trend, so growth is measured where data is stable and passed down. Code: `pipeline/forecast.py`.

1. **Growth** is year on year per state and trade (same months a year apart, so seasonality cancels), averaged with the national rate for that trade. If the latest half-year has broken away from the half-year before it by more than 15 points on at least 150 openings a year, the recent rate takes over. 18 such breaks were found.
2. **Shrinkage.** A rate too small to tell apart from noise is pulled toward zero: `g × g² ÷ (g² + 0.06²)`.
3. **State path.** Each forecast month is the same month last year times growth. The second year uses 85% of the growth rate.
4. **Top-down split.** State totals are split across districts by each district's share over the last 12 months. Only a district with 200 or more openings a year that is out-growing or lagging its state by 25 points or more keeps half of that drift. District forecasts therefore always add up to state and national totals.
5. **Announced projects.** Expected hiring from the investment pipeline is added, weighted by the probability the project proceeds, starting three months before commissioning.
6. **Supply** is projected from trainees already enrolled and seats already sanctioned: `seats × fill rate × completion × certification × labour-market entry`, shifted by course duration plus one month.

### Back-test

The index and forecast are rebuilt as of March 2025, September 2025 and March 2026 using only data that would have been available then (payroll arrives two months late; survey years appear six months after they end), then compared with what happened. The baseline is "next year repeats the last 12 months", which is how annual targets are usually set.

Error of the annual total (lower is better):

| Level | Horizon | Carry last year forward | Kaushal Radar |
| --- | --- | --- | --- |
| National | 6 / 12 / 18 months | 3.7% / 7.3% / 10.4% | 2.3% / 4.6% / 7.0% |
| State | 6 / 12 / 18 months | 4.7% / 8.1% / 11.5% | 3.9% / 6.4% / 8.8% |
| District | 6 / 12 / 18 months | 7.9% / 12.7% / 16.0% | 7.0% / 11.7% / 14.4% |
| District, fast-moving trades | 6 / 12 / 18 months | 10.8% / 20.8% / 26.9% | 7.7% / 14.0% / 19.1% |
| District, stable trades | 6 / 12 / 18 months | 7.5% / 11.7% / 14.3% | 6.9% / 11.4% / 13.7% |

The gain is largest where demand is moving, which is where a planner needs a forecast. For stable trades, last year is already a fair guide and the model adds little.

**Uncertainty.** Forecast ranges are not assumed. They are the 10th and 90th percentiles of the back-test errors, by horizon and by size of cell. Eighteen months out, a cell under 25 openings a year has a range of −42% to +86%; a cell over 400 has −19% to +16%. Project hiring widens the range by the share that might not materialise.

**Tested and rejected.** We tried shifting forecasts when new-enterprise registrations broke from trend. On the 48 district-sector cases it flagged in back-tests, error rose from 9.7% to 19.2%. It is switched off, and the comparison stays in the product.

Two earlier forecast designs (per-district damped trends with reconciliation, and a short-window log-slope) also lost to the baseline and were replaced.

## 4. Balance score and classes

```
score = 100 × tanh( 1.2 × ln( (D + 3) ÷ (S + 3) ) )
```

The score runs from −100 (saturated) to +100 (acute shortage) and is symmetric: twice the demand scores the same size as twice the supply. The `+3` steadies tiny cells.

| Class | Score | Roughly |
| --- | --- | --- |
| Acute shortage | 60 or more | demand at least 1.8 times supply |
| Shortage | 25 to 60 | demand 1.2 to 1.8 times supply |
| Balanced | −25 to 25 | within about 20% of each other |
| Surplus | −60 to −25 | supply 1.2 to 1.8 times demand |
| Saturated | −60 or less | supply at least 1.8 times demand |

A cell is ranked only if it has at least 12 openings or 12 entrants a year. Confidence is high when the forecast range is narrower than 55% of the forecast on at least 100 openings, medium under 95% on at least 25, otherwise low. Code: `pipeline/gap.py`.

## 5. Early-warning flags

A flag fires on the trajectory, not the level: a cell whose class in the planning year differs from its class today.

- **Types:** emerging shortage, deepening shortage, approaching saturation, deepening saturation; and, at state level, demand accelerating or slowing when the growth trend breaks.
- **Size filter:** the gap must be at least 40 people a year for a district, 150 for a state.
- **Lead time:** months until the rolling 12-month score first crosses into the new class.
- **Likelihood:** whether the low, central and high demand paths all end in the same class.
- **Severity:** critical when the cell ends in an extreme class, the gap is at least four times the size filter and at least two of the three paths agree; warning at twice the filter; otherwise watch.

The demo run produces 173 flags: 37 critical, 48 warning, 88 watch.

## 6. Seat plan

For every cell:

```
seats needed = demand when the cohort graduates ÷ (fill rate × completion × certification × labour-market entry)
```

The draft plan moves toward that number under rules a planner can defend:

- within 15% of need: no change
- increases limited to 40% a cycle, cuts to 30%
- a new course where none exists starts with at most 60 seats
- low-confidence cells move half as far
- seats change in batches of 5
- every row carries a reason code

A budget is then applied in the planner: same total seats (increases scaled to what the cuts release), +5%, +10% or unconstrained. Any row can be overridden by hand, and the sheet exports as CSV or Excel.

Two summary measures: **mismatch** is `Σ|D − S| ÷ Σ max(D, S)`, and **fixable by moving seats** is the part of the gap in a trade that sits in the wrong district of the right state.

## 7. Limits

- District-level demand is an estimate. It should be read with its range, and small cells have wide ranges.
- "Demand addressable by trainees" is a modelling definition and is smaller than total hiring.
- NCO-2015 predates roles such as solar or EV technicians. They are mapped to the nearest family and tracked as emerging roles.
- Workers move. A district's trainees can fill jobs elsewhere; catchment-based demand is not modelled yet.
- For two-year ITI trades, seats decided now graduate beyond the forecast horizon. The plan extends growth to the graduation date.
- Coverage, tilt and noise are fitted on simulated sources. They must be re-fitted on real feeds, and the back-test re-run, before any figure is used for a decision.

## 8. Moving to real data

| Input | Real source | Notes |
| --- | --- | --- |
| Job postings | Portal partnerships | De-duplicate, then code to NCO with the job-ad mapper |
| Vacancies | National Career Service | No public API; needs inter-ministry data sharing |
| Formal hiring | EPFO and ESIC payroll | Industry to occupation mapping from survey shares |
| Apprenticeship and employer demand | Skill India Digital Hub | Already inside MSDE |
| Benchmark | PLFS unit-level data | District is the basic stratum since January 2025 |
| Seats, enrolment, certification, placement | Skill India Digital Hub, NCVT MIS | Already inside MSDE and DGT |
| Informal workforce | e-Shram | Context for recognition of prior learning, not demand |

The ingestion format is in the README. Supplying those files is the only change needed to run the pipeline on real or evaluation data.

## 9. References

Problem evidence

- Comptroller and Auditor General of India, Report No. 20 of 2025, performance audit of PMKVY, press brief (18 December 2025): 56.14 lakh certified, 23.18 lakh placed; "absence of micro-level skill-gap information". https://cag.gov.in/uploads/PressRelease/PR-Press-Brief-Report-No-20-of-2025-English-06944f390e59d02-19424340.pdf
- NITI Aayog, *Transforming Industrial Training Institutes* (February 2023), on ITI seat utilisation. https://niti.gov.in/sites/default/files/2023-02/ITI_Report_02022023_0.pdf

Method

- NCAER for the Ministry of Skill Development and Entrepreneurship, *National Skill Gap Study for High Growth Sectors* (2025): recommends a regularly updated demand framework, big-data analysis of job sites and NCS, and a common NCO mapping. https://www.msde.gov.in/static/uploads/2025/07/6a62ad4129b524c392ed1450393804f4.pdf
- Ministry of Statistics and Programme Implementation, press note on the redesigned Periodic Labour Force Survey (14 May 2025): district as the basic stratum, monthly estimates.
- Jobs and Skills Australia, Nowcast of Employment by Region and Occupation (NERO) and the Occupation Shortage List: combining several sources and benchmarking to the labour force survey.
- Cedefop, Skills-OVATE: online job advertisements classified to ISCO-08 by region.
- OECD, Skills for Jobs database: a shortage index built from several labour-market signals.

Classifications and data

- National Classification of Occupations 2015, Ministry of Labour and Employment.
- National Skills Qualifications Framework and the National Qualifications Register, NCVET.
- Census of India 2011, district primary census abstract.
- District boundaries: https://github.com/udit-001/india-maps-data
