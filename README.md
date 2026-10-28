# Greek Gas-to-Power Market Analytics

Public dashboard of natural-gas power plants in the Greek electricity market: what the plants were scheduled to do (ISP) against what they did (SCADA), the theoretical cost of that generation (gas price, efficiency, CO₂), and how much of the system surplus is absorbed by constraint-driven gas generation.

**Live page:** https://kon-pappas.github.io/gas-power-dashboard-v2/
**Part of:** [Konstantinos Pappas Hub](https://kon-pappas.github.io/), with BESS, Power Flows, BigHydro and Live Greek Power.

## What the page shows

| Tab | Content |
|---|---|
| Daily overview | Per unit, scheduled (ISP) against actual (SCADA) generation of the selected day, units sorted by efficiency class (H-Class, F-Class, older generation & peakers). |
| Daily economics | Gas price (HGSIDA), CO₂ price (EUA), fleet efficiency, average fleet SRMC, generation and estimated cost, and a per-unit table (output, efficiency, CO₂, SRMC, cost). Cost is calculated hour by hour from the SCADA output. |
| Monthly analytics | One point per day of the month for the HGSIDA price, the average fleet SRMC and the fleet efficiency, with the days of the highest and lowest fleet SRMC and of the lowest and highest efficiency. |
| Generic constraints & surplus | Daily ISP residual surplus against the constraint-driven generation of gas units (their generic-constraint hours), with monthly totals. |

The *Methodology & Assumptions* button opens a short and a detailed version of the assumptions behind every tab, in Greek and English.

## Data sources

- **IPTO / ADMIE**: ISP results (scheduled; the *GenericConstraints* sheet gives the units and hours of the generic constraints) and System Realization SCADA (actual operation, files marked by IPTO as uncertified). Daily files. Only gas units on the Transmission System; lignite, large hydro and the co-generation unit with locked 24/7 output are left out.
- **HEnEx**: the gas price indices (HGSIDA and others). HGSIDA of a day is published the following day, by around midday.
- **oilpriceapi.com**: EUA CO₂ price, free tier (50 requests a month, no historical data): one call per daily run, never in a backfill. A day without a real price shows the last real one (weekends) or €85.00, marked *estimated*.

## How it is updated

`update_data.py` runs in GitHub Actions (`.github/workflows/update.yml`) only when [cron-job.org](https://cron-job.org) calls it, every day at **07:06 and 13:00 Greek time**. The workflow has no `schedule:` (see `docs/DECISIONS.md`, D07). The script writes `data/historical.json` (all data) and `data/meta.json` (time of the last run and of the next one); the page only shows them. The last 10 days are re-checked at every run to catch late publications and corrections.

If one day or one step fails, the script keeps the previous data of that day, writes everything that succeeded and exits with an error: the run turns red, the good data are still committed (`if: always()`). Run `python scripts/check_constraints.py` to check the constrained MWh against an independent calculation.

Manual run with dates (backfill): *Actions → Daily Energy Data Update → Run workflow*, with *Start Date* and *End Date* (`YYYY-MM-DD`). A backfill never calls the CO₂ API.

## Repository

```
index.html            page structure (Tailwind 3.4.17 and Chart.js 4.5.1 from a CDN, pinned)
data.js               texts (Greek / English), data loading, Methodology modal
dashboard.js          tabs, charts and what is shown on the page
update_data.py        data collection and all calculations (the economics and the constrained MWh)
data/historical.json  all data the page reads (written by update_data.py)
data/scada_hourly.json  hourly SCADA of the last 14 days, for update_data.py only (the page does not download it)
data/meta.json        last and next update (written by update_data.py)
scripts/              check_constraints.py (independent check of the constrained MWh)
docs/                 DECISIONS.md, KNOWN_ISSUES.md, ROADMAP.md
.github/workflows/    update.yml
```

Run locally: `pip install -r requirements.txt`, then `python update_data.py` (optional environment variables: `START_DATE`, `END_DATE`, `OILPRICE_API_KEY`).

## Documentation

- [`docs/DECISIONS.md`](docs/DECISIONS.md): every decision, why, and what was rejected.
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md): open problems, with measurements.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): order of work.

*Independent analysis of open data. Figures are estimates and indications, not official statistics, and not the position of IPTO/ADMIE, HEnEx or any other organisation.*
