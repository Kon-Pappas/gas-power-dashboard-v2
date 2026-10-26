# Roadmap

Order of work for aligning this dashboard with the hub house style (live-greekpower, Flows, BESS) while keeping its own analyses. One phase at a time: analysis, then the owner's decisions, then code; every visual change is shown first as a sample in a real browser, with numbers. Each batch is recorded in `DECISIONS.md`. Tests before every zip: Chromium at 360 and 320 px (and desktop), Greek and English, zero console errors.

## Phase 1: basics (batches 1–3)

- **Batch 1 (26 Oct 2026) — done:** updates only from cron-job.org at 07:06 and 13:00, no `schedule:`, Actions updated, one job at a time (D07, D09, D10); real *Last / Next update* from `data/meta.json` (D08); Tailwind and Chart.js pinned (D09); atomic writes (D10); Methodology text corrected (D12); README and `docs/` (D13)
- Batch 2: language remembered with `kp_lang` (K02); the accent defined in one place, blue (D11, K03)
- Batch 3: loading overlay as in the hub (K01), with real progress in step 1

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

- Decide first where the constraints are calculated (K10): in Python, the page would not need the hourly SCADA, which is 46 % of the file
- Then monthly files with a manifest **only if** the measured size justifies it (K11); refresh with ETag instead of `?v=<time>`

## Correctness (alongside the phases)

- Clock-change days, missing values, bare `except`, the DAM skip rule (K12–K15): after the check below

## Dated checks

- **26–27 Oct 2026:** the files of 25 Oct (25 hours): the DAM file (published 24 Oct) and the SCADA file (published 26 Oct about 06:05), checked as in BESS (K12)
- **After every batch:** compare the repository with the zip, byte by byte; check that the Pages build is green; run the page in Chromium at 360 and 320 px
- **Every two weeks:** measure the size of the data (K11)

## Open decisions (owner)

1. Mobile breakpoint 1024 → 768 px (K05)
2. Emoji in labels: keep, or coloured dots (K07)
3. Where the constraints are calculated: browser or Python (K10)
4. Cost table on phones: cards or accordion (K09)
5. Date format of the header on phones, with or without the year (K17)
