# Kaushal Radar

Labour market intelligence for skilling planners: where demand for skilled entrants is heading, district by district and trade by trade, set against the training seats already planned.

Built for Smart India Hackathon 2026, problem statement **SIH26246** (Ministry of Skill Development and Entrepreneurship): *AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine*.

## What it does

| Outcome asked for in the problem statement             | Where it is in the product                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Forecasting dashboard, national to district drill-down | `/dashboard`, `/district/[id]`, `/trades`, `/rankings`                                                                  |
| Documented methodology for a single demand index       | `/methodology` and [docs/METHODOLOGY.md](docs/METHODOLOGY.md)                                                                  |
| Early-warning flags for saturation and shortage        | `/warnings`                                                                                                                   |
| API and export layer for target setting                | `/planner`, `/api-docs`, `/api/v1/*` (JSON, CSV, Excel, OpenAPI)                                                          |
| Multilingual, accessible interface                     | English, Hindi, Marathi, Gujarati, Tamil; text size, high contrast, reduced motion, keyboard access, table view for every chart |

The pilot covers 181 districts in Maharashtra, Tamil Nadu, Uttar Pradesh and Gujarat, 40 trades in 9 sectors, 48 months of history and an 18-month forecast.

## What is real and what is simulated

No public source reports demand by district and trade. That gap is the reason for the system, and it means the demo cannot run on real labour-market data.

- **Real:** district boundaries, Census 2011 district population (scaled to 2026), NCO-2015 occupation codes, NSQF levels.
- **Simulated:** job postings, NCS vacancies, payroll additions, apprenticeship demand, the labour force survey benchmark, training seats and funnel, placement, e-Shram and enterprise registrations. Each is generated the way the real source behaves (partial coverage, bias, noise, delay). The pipeline never sees the hidden true demand, which is what lets us measure how well the index recovers it.
- **Illustrative:** the investment pipeline (announced projects with assumed job numbers and probabilities).

The `/data` screen says the same thing inside the product. All accuracy figures quoted in the product come from this simulated data.

## Run it

Requires Node 20 or later.

```bash
npm install
npm run dev        # http://localhost:3000
```

The data files the app reads are already in `data/`, so Python is only needed to regenerate them.

```bash
npm run build && npm start     # production build
npm run lint
npm run typecheck
```

## Regenerate the data

Requires Python 3.11 or later.

```bash
pip install -r pipeline/requirements.txt
npm run data          # python pipeline/run.py  -> writes data/*.json in about 3 seconds
npm run data:geo      # node pipeline/build_geo.mjs -> map geometry; only if boundaries change, after `npm run data`
```

The run is seeded, so it reproduces the same files every time. Scope, trades, hubs, events and model parameters are in `pipeline/config.py`.

## Run it on your own data

The pipeline reads CSV files instead of generating data when given a folder:

```bash
python pipeline/run.py --export-inputs pipeline/inputs   # write the demo data in the input format
python pipeline/run.py --inputs pipeline/inputs          # run on the files in that folder
```

Start from the exported files to see the exact format, then replace them.

| File                             | Columns                                                                                                | Required |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| `demand_signals.csv`           | `source` (portal, ncs, payroll, naps), `district_id`, `trade_id`, `month` (YYYY-MM), `count` | yes      |
| `survey_benchmark.csv`         | `state`, `trade_id`, `fiscal_year` (ending year), `openings`                                   | yes      |
| `seats.csv`                    | `district_id`, `trade_id`, `fiscal_year`, `seats`                                              | yes      |
| `training_funnel.csv`          | `district_id`, `trade_id`, `month`, `enrolled`, `certified`, `entrants`                    | yes      |
| `survey_district.csv`          | `district_id`, `sector_id`, `fiscal_year`, `openings`                                          | no       |
| `placement.csv`                | `district_id`, `trade_id`, `placement_rate` (0 to 1)                                             | no       |
| `eshram.csv`                   | `district_id`, `trade_id`, `registered`                                                          | no       |
| `enterprise_registrations.csv` | `district_id`, `sector_id`, `month`, `registrations`                                           | no       |

Rules: district ids are those in `data/geo.json`, trade and sector ids those in `data/taxonomy.json`. A missing row means zero, except that months after a source's last reported month count as not yet published. The time window is set by `START` and `N_HIST` in `pipeline/config.py`; rows outside it are ignored. Bad ids, missing columns and negative values stop the run with a message naming the file and the problem.

With supplied data the app shows a "Supplied data" badge, marks those sources as supplied on `/data`, and drops the recovery test (it needs the simulated truth). Forecast back-tests and the placement check still run.

Checked by round trip: exporting the demo data and running on the exported files reproduces the demo outputs, apart from last-digit rounding in a small number of values.

To point the app at a different output folder, set `KR_DATA_DIR` (the folder must also contain `geo/`).

## The language model

Two features use a language model: the job-ad mapper (`/mapper`) and "Ask the data". Both call Google Gemini's free tier through LangChain, and both work without it: with no key, a built-in keyword matcher and a figure lookup answer instead, and the screen says which one answered.

To turn Gemini on, copy `.env.example` to `.env.local` and add a key from [Google AI Studio](https://aistudio.google.com/apikey):

```
GOOGLE_API_KEY=your-key
```

The model only words answers. Figures are looked up from the data first and passed in as the only facts it may use. The Gemini path has not been exercised in this repository, because no key was available while it was built; test it after adding yours.

## Deploy

The app is a standard Next.js project with no database: the JSON in `data/` ships with it.

1. Push the folder to a GitHub repository.
2. In Vercel, choose **Add New > Project**, import the repository and accept the defaults.
3. Optional: add `GOOGLE_API_KEY` under **Settings > Environment Variables**, then redeploy.

Or, from this folder: `npx vercel` for a preview and `npx vercel --prod` for production.

## How it is put together

```
pipeline/            Python: data in, JSON out
  config.py          scope, trades, hubs, model parameters
  geo.py             district table from boundaries and census
  synth.py           demo data generator (plays the role of the real world)
  inputs.py          CSV ingestion and export
  index.py           Composite Demand Index
  forecast.py        forecast, back-test, uncertainty bands
  gap.py             balance score, early-warning flags, seat plan
  run.py             runs everything and writes data/
  build_geo.mjs      map geometry for the app
data/                what the app and API serve (generated)
src/app/             screens and API routes (Next.js App Router)
src/components/      charts, map, shell, controls
src/lib/             data access, formatting, translations, AI helpers
docs/METHODOLOGY.md  the method, written out
```

Pages and API routes read the same files through `src/lib/data.ts`, so the dashboard and the API cannot disagree.

## Limits to know about

- District-level demand is an estimate with a range, not a count. Small cells have wide ranges and say so.
- The 40 trades are a pilot selection. Qualification-pack codes are shown only where we could map them.
- District and trade names are in English in every language, except trade names in Hindi. The Hindi, Marathi, Gujarati and Tamil interface text was machine-drafted and needs review by native speakers.
- Results come from simulated sources. Real feeds will behave differently, and the coverage and noise estimates will need re-fitting.
- Workers move between districts. The balance is computed within a district and does not yet model catchments.

## Sources

- Boundaries: [udit-001/india-maps-data](https://github.com/udit-001/india-maps-data) (district TopoJSON), with post-2011 districts mapped in `pipeline/config.py`.
- Population: Census of India 2011, district primary census abstract (the widely mirrored `india-districts-census-2011.csv` compilation).
- Occupation codes: National Classification of Occupations 2015. Qualification levels: National Skills Qualifications Framework.
- Background, evidence and method references: [docs/METHODOLOGY.md](docs/METHODOLOGY.md), section 9.

Check the licence of each source before any use beyond this prototype.
