# Greek Gas-to-Power Market Analytics

Public dashboard of natural-gas power plants in the Greek electricity market: what the plants were scheduled to do (ISP) against what they did (SCADA), the theoretical cost of that generation (gas price, efficiency, CO₂), and how much of the system surplus is absorbed by constraint-driven gas generation.

**Live page:** https://kon-pappas.github.io/gas-power-dashboard-v2/
**Part of:** [Konstantinos Pappas Hub](https://kon-pappas.github.io/), with BESS, Power Flows, BigHydro and Live Greek Power.

## What the page shows

| Tab | Content |
|---|---|
| Daily Overview | Per unit, scheduled (ISP) against actual (SCADA) generation of the selected day, units sorted by efficiency class (H-Class, F-Class, Peakers). |
| Daily Economics | Gas price (HGSIDA), CO₂ price (EUA), fleet efficiency, average fleet SRMC, generation and estimated cost, and a per-unit table (produced, efficiency, CO₂, SRMC, cost). Cost is calculated hour by hour from the SCADA output. |
| Monthly Analytics | The month's HGSIDA, average fleet SRMC and fleet efficiency, with the peak and best grid-cost days and the worst and best efficiency days. |
| Generic Constraints & Surplus | Daily ISP residual surplus against the generation of gas units during their generic-constraint hours (out of merit), with monthly totals. |

The *Methodology & Assumptions* button opens a short and a detailed version of the assumptions behind every tab, in Greek and English.

## Data sources

- **IPTO / ADMIE**: ISP results (scheduled; the *GenericConstraints* sheet gives the units and hours of the generic constraints) and System Realization SCADA (actual operation, files marked by IPTO as uncertified). Daily files. Only gas units on the Transmission System; lignite, large hydro and the co-generation unit with locked 24/7 output are left out.
- **HEnEx**: day-ahead market results (MCP) and the gas price indices (HGSIDA and others). HGSIDA of a day is published the following day, by around midday.
- **oilpriceapi.com**: EUA CO₂ price, free tier (50 requests a month, no historical data): one call per daily run, never in a backfill. A day without a real price shows the last real one (weekends) or €85.00, marked *estimated*.

## How it is updated

`update_data.py` runs in GitHub Actions (`.github/workflows/update.yml`) only when [cron-job.org](https://cron-job.org) calls it, every day at **07:06 and 13:00 Greek time**. The workflow has no `schedule:` (see `docs/DECISIONS.md`, D07). The script writes `data/historical.json` (all data) and `data/meta.json` (time of the last run and of the next one); the page only shows them. The last 10 days are re-checked at every run to catch late publications and corrections.

Manual run with dates (backfill): *Actions → Daily Energy Data Update → Run workflow*, with *Start Date* and *End Date* (`YYYY-MM-DD`). A backfill never calls the CO₂ API.

## Repository

```
index.html            page structure (Tailwind 3.4.17 and Chart.js 4.5.1 from a CDN, pinned)
data.js               texts (Greek / English), data loading, Methodology modal
dashboard.js          tabs, calculations shown on the page, charts
update_data.py        data collection and all calculations of the economics
data/historical.json  all data (written by update_data.py)
data/meta.json        last and next update (written by update_data.py)
docs/                 DECISIONS.md, KNOWN_ISSUES.md, ROADMAP.md
.github/workflows/    update.yml
```

Run locally: `pip install -r requirements.txt`, then `python update_data.py` (optional environment variables: `START_DATE`, `END_DATE`, `OILPRICE_API_KEY`).

## Documentation

- [`docs/DECISIONS.md`](docs/DECISIONS.md): every decision, why, and what was rejected.
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md): open problems, with measurements.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): order of work.

*Independent analysis of open data. Figures are estimates and indications, not official statistics, and not the position of IPTO/ADMIE, HEnEx or any other organisation.*
