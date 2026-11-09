# Roadmap

Order of work for aligning this dashboard with the hub house style (live-greekpower, Flows, BESS) while keeping its own analyses. One phase at a time: analysis, then the owner's decisions, then code; every visual change is shown first as a sample in a real browser, with numbers. Each batch is recorded in `DECISIONS.md`. Tests before every zip: Chromium at 360 and 320 px (and desktop), Greek and English, zero console errors.

## Phase 1: basics (batches 1–3)

- **Batch 1 (26 Oct 2026) — done:** updates only from cron-job.org at 07:06 and 13:00, no `schedule:`, Actions updated, one job at a time (D07, D09, D10); real *Last / Next update* from `data/meta.json` (D08); Tailwind and Chart.js pinned (D09); atomic writes (D10); Methodology text corrected (D12); README and `docs/` (D13)
- **Batch 2 (26 Oct 2026) — done:** language remembered with `kp_lang` (D15); the accent defined in one place, blue, with 28 decorative uses and the header values (D11, D14)
- **Batch 3 (26 Oct 2026) — done:** the SCADA hours from the calendar with a check against the file's SUM column, and the page reads hours by name (D17); the day-ahead prices removed and the Methodology text corrected (D16)
- **Batch 4 (26 Oct 2026) — done:** the ISP read from the quarter-hours of the calendar and checked against the file's TOTAL (D18); the exclusions written down (D19)
- **Batch 5 (26 Oct 2026) — done:** the loading overlay as in the hub, with real progress and one step per tab (D20). **Phase 1 is complete**

## Phase 2: data colours

- **Batch 6 (26 Oct 2026) — done:** one colour per entity in one place, no data colour equal to the accent, green only for "complete / positive" (D11, D21). **Phase 2 is complete**

## Phase 3: house shell

- **Batch 7 (26 Oct 2026) — done:** the shell of the hub: the phone layout stops at 768 px, one picker box with the pill inside, dates in the visitor's language, the header times on one line, the tab grid (D22)
- **Batch 8 (27 Oct 2026) — done:** the Methodology window as in the hub: Esc, focus, no scroll behind it, opens at the section of the tab (D23). **Phase 3 is complete**
- **Batch 9 (27 Oct 2026) — done:** the Methodology covers every figure of the page, with a new section for Monthly Analytics, and the links *Methodology →* in the tabs (D24)

## Phase 4: texts

- **Batch 10 (27 Oct 2026) — done:** the Greek page in Greek, capital only on the first word, no all-caps labels, no emoji, the cards renamed, the window title of the hub (D25). **Phase 4 is complete**; the tooltips of the charts belong to Phase 5 (K26)

## Phase 5: charts

- **Batch 11 (27 Oct 2026) — done:** own tooltips on the three charts, all numbers in the language of the page, a real calendar axis with gaps, the economics empty state in both languages, the duplicate € removed (D26). **Phase 5 is complete**; the hour axis and the unused plugins of the hub do not apply to this page (no hourly chart, no plugin)

## Phase 6: mobile

- **Batch 12 (27 Oct 2026) — done:** the cost table as cards below 768 px, the up-arrow, a dash where data is missing, the economics row (D27). **Batch 13 (27 Oct 2026) — done:** the three cards per row and the shorter date label (D28). **Phase 6 is complete**

## Phase 7: data

- **D31 — part-load efficiency of the F-class, 28 Oct 2026:** batch 16 changes the table `PLANT_SPECS` (eight units), the Methodology and the docs; the history is recalculated by the backfill above. Still open: K29 (old Komotini), K30 (maximum loads, check of the level with the gas of the power sector)
- **K10 — done 28 Oct 2026 (D29 and D30):** the constrained MWh are calculated in Python, the hourly SCADA of the last 14 days is in `data/scada_hourly.json` and has left `historical.json`, a failing day keeps its previous data; the data file went from 215 to 106 KB gzip
- Then monthly files with a manifest **only if** the measured size justifies it (K11); refresh with ETag instead of `?v=<time>`

## Phase 8: analysis (agreed 9 Nov 2026, D32 and D33)

- **Batch 17 — TTF collection (D32):** `ttf_prices`, a separate call, the quote time stored, no change in the page. After the upload: check the log of the first cron run (the line *Fetched latest TTF price*), then the data after a day or two
- **K20** (the hours of the constraints on a clock-change day): before the unit data, which use the same hour mapping
- **Python key for the daily review** (decomposition, outages and returns, constraint detail), with a backfill of the whole history; its own file, loaded when the tab opens
- **The tab *Daily review* (last) and the new boxes in *Monthly analytics* and *Constraints & surplus* (D33):** a sample with real numbers before the code, as always
- **Hourly day-ahead price** (the `dam_mcp_hourly` of D16 comes back, about 8 to 10 KB gzip) and the **cost of the constraints** (the unit's SRMC against the price, per hour of constraint)
- **K11 (monthly files) and a longer history (K32):** a backfill 1 Apr to 31 May after a test week; from 1 Jan only after K11

## Correctness (alongside the phases)

- Missing values and bare `except` (K13, K14) are done (D29). Clock-change days are done for the SCADA (D17) and the ISP (D18); K20 remains. K28 (windows with a half hour) after step 2

## Dated checks

- **26 Oct 2026 — done:** the files of 25 Oct (25 hours) were checked with the real SCADA and DAM files (D16, D17). **Done 26 Oct 2026:** the fix of D17 went online and the 10-day re-check repaired the 25 Oct record (73,419 MWh, 25 hourly keys). **Before 28 Mar 2027 (23 hours):** K20
- **26 Oct 2026 — done:** the ISP history (K21 → D18): five manual runs and a sixth for 21–26 Oct, 148 days; the ISP / SCADA ratio went from 1.242 to 1.006 on average
- **After every batch:** compare the repository with the zip, byte by byte; check that the Pages build is green; run the page in Chromium at 360 and 320 px
- **D31 backfill — done 28 Oct 2026:** five runs (1 Jun to 28 Oct), the repository checked afterwards: 148 of 148 days identical to the new table, the targets of 25 Oct reached (fleet cost 13,432,491 EUR, fleet SRMC 182.96, ElpedThisv 203.59), the size 106 KB gzip
- **After the first real run of D30 (done 28 Oct):** open its log (a `Cleanup` line says the hourly SCADA was removed from `historical.json`; no `::warning` or `::error`, no `UserWarning`), check that `historical.json` is about 106 KB gzip, and run `python scripts/check_constraints.py`
- **After the first real run of D29 (done 28 Oct):** open its log (the new key, `scada_hourly.json`, no `::warning` or `::error`) and run `python scripts/check_constraints.py` on the new `historical.json`
- **Every two weeks:** measure the size of the data (K11)

## Open decisions (owner)

1. A full list of pinned dependencies (K19)
2. Constraint windows with a half hour: weight the edge hours (from now on, or with a backfill of the old days), or leave it (K28)
3. The old Komotini unit: the same consistency and its minimum load (K29), after the backfill of D31
4. The one-off probe of `past_month` for the TTF (and the CO2) on the free plan, and a test week 1 to 7 Apr before the backfill of April and May (K32)
5. A run in the evening for the price calls only (K31), after a few weeks of TTF data

Decided on 9 Nov 2026: the TTF is collected with a separate call and its quote time, no paid plan and no history for now; one new tab, the last one, with the boxes of month scale moved (not copied) to *Monthly analytics* and *Constraints & surplus*; units sorted by their effect on the cost; a return is 3 days without production; the hourly day-ahead price comes back; *N+ days* for a stretch that begins before 1 Jun (D32, D33).
Decided on 28 Oct 2026: the part-load efficiency of the eight F-class units with k = 0.30 and four minimum loads from the data, with a backfill of the whole history; the old Komotini later and apart (D31).
Decided on 27 Oct 2026: the constraints are calculated in Python in two batches, with a rolling window of 14 days for the hourly SCADA, blank cells counted and not stored as null, and failures isolated per day (D29); three cards per row from 1024 to 1279 px and the shorter date label on phones (D28); no emoji, labels in sentence case, the Greek terms and the names of the cards, the units keep their Latin names on the Greek page (D25); the cost table as cards on phones (D27).
Decided on 26 Oct 2026: the phone layout stops at 768 px and the header times on phones are shown without the year (D22); the texts of the Methodology and the links in the tabs (D24).
