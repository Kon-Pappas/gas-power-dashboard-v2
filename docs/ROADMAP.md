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

## Phase 8: analysis (agreed 9 and 10 Nov 2026, D33 and D35)

- **K33 (the right to publish third-party prices) — decided (D35, D38):** the TTF is removed; the CO2 price is an input only, is not shown, and is stored **rounded to 0.5 EUR/t** as an estimate of the owner (the source, Investing.com via OilPriceAPI, is not asked); no TTF in any tab and no second TTF series. **Order of work, done:** batch 23 (D38, D39) → backfill in 2 runs → batch 24 (D40)
- **Backfill of D38 — done and checked on 10 Nov 2026:** the cleanup of 71 values, then 26 Aug to 30 Sep and 1 to 30 Oct; all 75 days identical to the independent recomputation (see D38)
- **Batch 25 — done (D41, D42):** alignment with the *Τυφλοσούρτης* (tabs 3 + 2 on phones, six loading steps, refresh with `no-cache` / ETag, `scripts/data_size.py`), the Monthly analytics and Constraints tabs with the boxes first, the first day of the history read from the data, the *+* at the start of every continuous block. **The history grows backwards in segments (K32):** 21 to 31 May done and checked; **next, after uploading batch 25: 1 Apr to 20 May in two runs** (for example 1 to 30 Apr and 1 to 20 May), about +34 KB gzip; **K11 (files per month) must be decided before about April 2027**
- **Batch 26 — done (D43):** a second try (3 times) for the downloads of ADMIE and HEnEx for transient errors; the first month of the history shows one card *The month in numbers*; the Methodology reads the first day of the history from the data; docs (K32 closed, K11 updated, K36)
- **K34 (terms of use of the HEnEx and ADMIE data), checked 10 Nov:** the HEnEx terms forbid making its data available on a website without its written consent; the ADMIE terms have no such clause. An email to info@enexgroup.gr is the first step, **before any new use of the HEnEx file**
- **The owner's idea of 10 Nov: the other columns of the daily HEnEx file** (traded volume, number of orders and trades, price range, closing price against the VWAP, the indicative prices of D+2 and D+3) instead of the HGMBI, HGMSI and HGSIWD. It has independent information, unlike those three; on 8 Nov the platform volume (WD + DA, 20,160 MWh) was 16.3 % of the gas burn of the fleet, and D+2 and D+3 had no trades. **On hold until K34**; a first look needs a backfill of the extra columns
- **The gas price panel (analysis of 10 Nov, 161 days):** the HGSIWD is almost the HGSIDA (mean difference -0.23 EUR/MWh, median 0; 17 days with a difference of 3 EUR/MWh or more); the **HGMBI and HGMSI are not independent information**: they are the HGSIDA times 1.093 and 0.895 (standard deviations 0.031 and 0.026), the band between them is **19.9 % ± 0.6 %** of the price and the correlation with the HGSIDA is 0.993; none of the differences has a relation with the daily change of the fleet gas burn (correlations between -0.09 and +0.11). So the panel can show the four indices, but the HGMBI-HGMSI band is a proportional risk band and not a new signal. HEnEx itself states a 96 % correlation of the HGSIDA with the TTF EGSI (a published fact that can be cited with its source, without collecting the TTF)
- **K20 (D34) — done:** the constraint hours on days of 23 or 25 hours; before the unit data, which use the same hour mapping
- **Python key for the daily review — done 10 Nov 2026 (D36, batch 21):** `data/review.json` (decomposition, outages and returns, constraint effect, by day and by month), built with the program code from the whole hourly history, so no backfill runs. **The first real run checked on 9 Nov 20:36: the file is identical to the shipped one.**
- **The tab *Daily review* — done (D37, batch 22):** the last tab, with the prices box left out (D35, K34). **The boxes of month scale — done (D40, batch 24):** in *Monthly analytics* (the month against the previous one, what moved the cost, the availability of the units with the events of the month) and in *Constraints & surplus* (the effect of the constraints per unit), moved there and not copied; `review.json` holds their figures. **Next:** the cost of the constraints at a market price (the hourly day-ahead price, **after checking the rights of its source**), and the longer history (K11 monthly files, the backfill of April and May after a test week, K32)
- **The tab *Daily review* (last) and the new boxes in *Monthly analytics* and *Constraints & surplus* (D33):** a sample with real numbers before the code, as always
- **Hourly day-ahead price** (the `dam_mcp_hourly` of D16 comes back, about 8 to 10 KB gzip) and the **cost of the constraints** (the unit's SRMC against the price, per hour of constraint)
- **A longer history (K32) — done on 10 Nov 2026 (D42, D43): 1 Apr 2026 to today, without a gap.** From **1 Jan only after K11** (files per month): the data grew to 153.5 KB gzip and the limit of 250 KB comes in about 154 days (about 12 Apr 2027), so **K11 must be decided before about January 2027**

## Correctness (alongside the phases)

- Missing values and bare `except` (K13, K14) are done (D29). Clock-change days are done for the SCADA (D17), the ISP (D18) and the constraints (D34). K28 (windows with a half hour) after step 2

## Dated checks

- **After uploading batch 22:** open the live page, the fifth tab: the figures of the last complete day, both languages, the phone; the header *Last update* equal to the last bot run (this also shows that the Pages build follows the bot commits)
- **After the first run with D36 — done 9 Nov 20:36 (see D36):** open its log (the line *Review: 161 days, 20 returns, 6 months, 116 days with the effect of the constraints*; no `::error`), check that `data/review.json` is in the commit, that its old days are identical to the shipped file (only new days appear) and run `python scripts/check_constraints.py` (it must also say that the review equals the constrained MWh)
- **K34, after the email to HEnEx:** the answer, or a reminder after 14 days; until then nothing more from the HEnEx file is added to the public data
- **After the first run with D40:** the new `review.json` (monthly figures with many decimals) equal to the shipped one, the Monthly and Constraints tabs open on the live page and the numbers of October as in D40
- **After uploading batch 25:** on the live page, the browser's Network tab: at the **second visit `historical.json`, `review.json` and `meta.json` answer 304** (this is the check that the test could not do on the real GitHub Pages); on the phone the tabs are 3 + 2 and the loading screen has 6 steps; `python scripts/data_size.py` after each segment of the history
- **26 Oct 2026 — done:** the files of 25 Oct (25 hours) were checked with the real SCADA and DAM files (D16, D17). **Done 26 Oct 2026:** the fix of D17 went online and the 10-day re-check repaired the 25 Oct record (73,419 MWh, 25 hourly keys). **28 Mar 2027 (23 hours) and 31 Oct 2027 (25 hours): the first real constraint with a window on such a day** (D34): compare the MWh of the program with the sum of the hourly SCADA at the columns stored in *Hour Index From/To*, and run `python scripts/check_constraints.py`
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
4. **K34: the written consent of HEnEx** for the public display of its indices (the email was sent on 9 Nov, waiting for the answer)
   **K35: the delivery day of the HGSIDA** — decided to keep it for now; to be revisited (needs a backfill of all days)
5. **K33 is closed for the CO2 (D38).** The terms of use of the HEnEx data (K34) are still waiting for the answer of HEnEx; for the ADMIE data nothing restrictive was found
6. ~~A test week before the backfill of April and May (K32)~~ — **done in a better way on 10 Nov 2026** (D42): the segments were added backwards from the first day, so that no gap exists
7. The quote time of the CO2 (K31), optional and after K33

Decided on 10 Nov 2026 (D36): the HGSIDA keeps its day and the Methodology states it (K35); the key of the Daily review is built first (`data/review.json`).
Decided on 10 Nov 2026: the terms of use of the HEnEx and ADMIE data are checked first, before the other work (K34); the email to OilPriceAPI was sent.
Decided on 10 Nov 2026 (D40): the boxes of month scale go to their tabs; the CO2 row of the month table is the emissions (t per day); the HGSIDA row stays.
Decided on 10 Nov 2026 (D43): a second try for the downloads, and a card of full width for the first month of the history.
Decided on 10 Nov 2026 (D41, D42): the alignment with the Τυφλοσούρτης (tabs 3 + 2, six loading steps with the review loaded at the start, no-cache refresh), the boxes first in Monthly analytics and in Constraints & surplus, the work goes on without waiting for HEnEx, ENTSO-E only as a technical alternative for the MCP, the history grows backwards in segments (21-31 May done).
Decided on 10 Nov 2026 (D38, D39): the CO2 price is stored rounded to 0.5 EUR/t (half up) as an estimate of the owner, the source is not asked, the Methodology says it is an indicative quote and not the ICE price; a backfill of 26 Aug to 30 Oct in 2 runs; the pill and the button of the daily review go into batch 23; the boxes of month scale move to batch 24, after the backfill.
Decided on 10 Nov 2026 (D35): the TTF is removed; the CO2 price stays in the calculations and is no longer displayed (the card becomes CO2 emissions in tonnes), the source is named in the Methodology and in the README; the email to the provider.
Raised on 9 Nov 2026: K33. The account page confirms that the free plan has no history (K32).
Decided on 9 Nov 2026: K20 together with the corrections of the docs.
Decided on 9 Nov 2026: the TTF is collected with a separate call and its quote time, no paid plan and no history for now; one new tab, the last one, with the boxes of month scale moved (not copied) to *Monthly analytics* and *Constraints & surplus*; units sorted by their effect on the cost; a return is 3 days without production; the hourly day-ahead price comes back; *N+ days* for a stretch that begins before 1 Jun (D32, D33).
Decided on 28 Oct 2026: the part-load efficiency of the eight F-class units with k = 0.30 and four minimum loads from the data, with a backfill of the whole history; the old Komotini later and apart (D31).
Decided on 27 Oct 2026: the constraints are calculated in Python in two batches, with a rolling window of 14 days for the hourly SCADA, blank cells counted and not stored as null, and failures isolated per day (D29); three cards per row from 1024 to 1279 px and the shorter date label on phones (D28); no emoji, labels in sentence case, the Greek terms and the names of the cards, the units keep their Latin names on the Greek page (D25); the cost table as cards on phones (D27).
Decided on 26 Oct 2026: the phone layout stops at 768 px and the header times on phones are shown without the year (D22); the texts of the Methodology and the links in the tabs (D24).
