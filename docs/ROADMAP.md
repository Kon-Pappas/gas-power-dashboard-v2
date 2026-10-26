# Roadmap

Order of work for aligning this dashboard with the hub house style (live-greekpower, Flows, BESS) while keeping its own analyses. One phase at a time: analysis, then the owner's decisions, then code; every visual change is shown first as a sample in a real browser, with numbers. Each batch is recorded in `DECISIONS.md`. Tests before every zip: Chromium at 360 and 320 px (and desktop), Greek and English, zero console errors.

## Phase 1: basics (batches 1–3)

- **Batch 1 (26 Oct 2026) — done:** updates only from cron-job.org at 07:06 and 13:00, no `schedule:`, Actions updated, one job at a time (D07, D09, D10); real *Last / Next update* from `data/meta.json` (D08); Tailwind and Chart.js pinned (D09); atomic writes (D10); Methodology text corrected (D12); README and `docs/` (D13)
- **Batch 2 (26 Oct 2026) — done:** language remembered with `kp_lang` (D15); the accent defined in one place, blue, with 28 decorative uses and the header values (D11, D14)
- **Batch 3 (26 Oct 2026) — done:** the SCADA hours from the calendar with a check against the file's SUM column, and the page reads hours by name (D17); the day-ahead prices removed and the Methodology text corrected (D16)
- **Batch 4 (26 Oct 2026) — code done, history to recalculate:** the ISP read from the quarter-hours of the calendar and checked against the file's TOTAL (D18); the exclusions written down (D19)
- Batch 5: loading overlay as in the hub (K01), with real progress in step 1 (first as a sample in a browser)

## Phase 2: data colours

- One colour per entity across all tabs; no data colour equal to the accent; green only for "complete / positive" (D11, K04)

## Phase 3: house shell

- One picker box, dates in the visitor's language, status pill inside the box (K18, H06), the mobile breakpoint (decision on 768 px pending, K05), modal with Esc and focus (K06), header labels that fit one line (K17, decision on the date format pending)

## Phase 4: texts

- No all-caps labels, capital rule for Greek and English, accents (C01, C02, K07); the Greek page fully Greek, with the five English legends (K08); emoji: keep or replace by coloured dots (decision pending)

## Phase 5: charts

- Own tooltips on the three charts, hours as "00–01", shared Chart.js defaults (K08)

## Phase 6: mobile

- The cost table: cards or the present accordion (decision pending, K09); secondary-controls box, 3 + 2 tabs grid where it applies, up-arrow (H06)

## Phase 7: data

- Decide first where the constraints are calculated (K10): in Python, the page would not need the hourly SCADA, which is half of the file (49.5 %)
- Then monthly files with a manifest **only if** the measured size justifies it (K11); refresh with ETag instead of `?v=<time>`

## Correctness (alongside the phases)

- Missing values and bare `except` (K13, K14). Clock-change days are done for the SCADA (D17) and the ISP (D18); K20 remains

## Dated checks

- **26 Oct 2026 — done:** the files of 25 Oct (25 hours) were checked with the real SCADA and DAM files (D16, D17). **Before 4 Nov 2026:** the fix of D17 must be online, so that the 10-day re-check repairs the 25 Oct record. **Before 28 Mar 2027 (23 hours):** K20
- **After batch 4 is online — the ISP history (K21):** five manual runs of *Daily Energy Data Update* with Start Date and End Date: 2026-06-01 → 2026-06-30, 2026-07-01 → 2026-07-31, 2026-08-01 → 2026-08-31, 2026-09-01 → 2026-09-30, 2026-10-01 → 2026-10-15, one after the other. After each, the ISP / SCADA ratio of its days has to be about 0.8–1.2 (it was 1.12–1.35 before) and the log must have no `⚠ ISP` line
- **After every batch:** compare the repository with the zip, byte by byte; check that the Pages build is green; run the page in Chromium at 360 and 320 px
- **Every two weeks:** measure the size of the data (K11)

## Open decisions (owner)

1. Mobile breakpoint 1024 → 768 px (K05)
2. Emoji in labels: keep, or coloured dots (K07)
3. Where the constraints are calculated: browser or Python (K10)
4. Cost table on phones: cards or accordion (K09)
5. Date format of the header on phones, with or without the year (K17)
6. A full list of pinned dependencies (K19)
