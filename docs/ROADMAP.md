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
- **26 Oct 2026 — done:** the ISP history (K21 → D18): five manual runs and a sixth for 21–26 Oct, 148 days; the ISP / SCADA ratio went from 1.242 to 1.006 on average
- **After every batch:** compare the repository with the zip, byte by byte; check that the Pages build is green; run the page in Chromium at 360 and 320 px
- **Every two weeks:** measure the size of the data (K11)

## Open decisions (owner)

1. Where the constraints are calculated: browser or Python (K10)
2. Cost table on phones: cards or accordion (K09)
3. A full list of pinned dependencies (K19)

Decided on 27 Oct 2026: no emoji, labels in sentence case, the Greek terms and the names of the cards, the units keep their Latin names on the Greek page (D25).
Decided on 26 Oct 2026: the phone layout stops at 768 px and the header times on phones are shown without the year (D22); the texts of the Methodology and the links in the tabs (D24).
