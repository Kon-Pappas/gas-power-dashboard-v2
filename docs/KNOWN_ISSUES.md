# Known issues

Open problems found in the review of 26 October 2026, when the alignment with the other hub dashboards began. Each item says what is wrong, why it matters and where it is planned (see `ROADMAP.md`). Resolved items are moved to `DECISIONS.md`.

| # | Issue | Why it matters | Plan |
|---|---|---|---|
| K06 | The Methodology modal has no Esc key, no focus handling and no `aria-modal`; the page scrolls behind it | Keyboard and screen-reader users | Phase 3, next batch |
| K07 | Texts: 42 all-caps classes (20 in `index.html`, 4 in `dashboard.js`, 18 in `data.js`, the last ones being the Methodology headings), four capital column headings (FACTORY, PRODUCED, EFFICIENCY, COST), an emoji in four card labels and in the status pill, tab titles with a capital on every word. The tab label in the static HTML ("System Needs (Surplus)") differs from the one the page writes ("Generic Constraints & Surplus"), seen only without JavaScript | C02 and C01 of the hub; the Greek page also needs accents everywhere | Phase 4 (emoji: decision pending) |
| K08 | The Greek page is not fully Greek: five chart legends are English only (*HGSIDA Gas Price*, *Avg Fleet SRMC*, *Fleet Efficiency*, *Residual Energy Surplus*, *Generic Constraints (Out of Merit)*); the three charts use the default Chart.js tooltips | Rule "Greek page 100 % Greek"; the tooltips are the one place where the numbers are read | Phases 4 and 5 |
| K09 | The cost table on phones scrolls horizontally inside its wrapper, hides three columns below 640 px and shows the rest of each unit in an accordion; the hub pattern is cards with the numbers aligned right | Horizontal scrolling competes with the gestures of the phone. The accordion with the greyed other rows was kept by the owner in September 2026, so cards or accordion is a decision | Phase 6 (decision pending) |
| K10 | The Surplus tab calculates the constrained MWh **in the browser** (`dashboard.js`, about lines 861–908): it matches unit names, sums the hourly SCADA inside the constraint hours and leaves out the days without SCADA. The hourly SCADA is read only here and is 46 % of the compressed data file | Hub rule: Python calculates, the page only shows. The unit-name matching is where the Elpedison error hid for months. Calculated in Python, the page would not need the hourly SCADA (see K11) | Before Phase 7 (decision pending) |
| K11 | **Size of the data (measured 26 Oct 2026, after D16):** 148 days = 2,595 KB raw (`indent=2`), **211 KB gzip** (level 6; 227 KB before the removal of the day-ahead prices), growing about 1.45 KB/day gzip; the limit of **250 KB gzip is reached in about 27 days**. Composition of the compressed file: hourly SCADA 49.5 %, daily economics 32 %, ISP 8 %, daily SCADA 6.5 %, the rest 4 %. The page downloads the whole file at every visit (`?v=<time>`) | Past the limit a visitor on a poor connection waits for the download, not for the processor | Phase 7; K10 is the larger saving (the hourly SCADA is half of the file); measure with a `scripts/data_size.py` as in BESS (to add) |
| K13 | A blank cell of the hourly SCADA is written as `0.0`, not `null` | A missing hour looks like a real zero | Decision pending |
| K14 | Two bare `except:` (in `fetch_excel` and `process_henex`) swallow every error without a trace | A failed download or a changed file format leaves no sign in the log | Decision pending |
| K16 | **CO₂ history.** 1 Jun – 23 Aug 2026 is the flat €85.00 estimate. Real prices from 24 Aug were written by the old by-date lookup until the end of September 2026 and can be shifted by one day (up to about €2/t); the owner decided not to re-fetch them (the free tier has 50 requests a month). The price of the latest call may be the previous close. On 26 Oct 2026 the backfills also removed 7 empty placeholders (`CO2_Price: None` for 24, 25 and 30 Aug and 6, 7, 13 and 14 Sep); those days already used the €85.00 estimate, so no figure changed | A small, documented difference in the cost of past days | Accepted; written in the Methodology |
| K19 | The workflow installs the five packages of `requirements.txt` at fixed versions, but not their dependencies. **26 Oct 2026:** the run installed `python-dateutil 3.0.0` (the run of 27 Sep: 2.9.0.post0), a new major version, with pandas 2.2.1; it passed | A new version of a dependency can break the update without any change in the repository | A full list of pinned versions (decision pending) |
| K20 | **Clock-change days and the hours of a constraint.** The hours of a Generic Constraint (from the ISP2 file) are matched with the SCADA hours of the same day by number. On a 25- or 23-hour day the hours after the clock change can differ by one between the two (the ISP2 file may use CET like HEnEx, or Greek time: **not yet checked**). 25 Oct 2026 had no gas constraint, so nothing was affected; the next such day is 28 Mar 2027 | A constraint can be given one hour off on two days a year | The ISP2 file of 25 Oct was checked on 26 Oct 2026: its *GenericConstraints* sheet has only Alouminio, with a full-day window, so it does not settle the question. To check with the first file that has a gas constraint on a clock-change day, before 28 Mar 2027 |
| K22 | **The *Total est. cost* KPI is wider than its card:** measured 26 Oct 2026, the value `13.639.458 €` ends 19 px to the right of its card at 320 px (at 360 px it fits with 1 px to spare) and the page is 337 px wide at 320 px in the tab Daily Economics; **at 1024 px** the page is 1052 px wide in both languages (the same before batch 7) | A large figure touches or crosses the edge of the screen on the narrowest phones and on tablets in landscape; it grows with the daily cost | Phase 6 (the KPI row) |

Resolved: K02 → D15; K03 → D14 (the remaining uses of green are in K04 and K01); K12 → D17 (SCADA) and D16 (day-ahead prices); K15 → D16; K01 → D20; K21 → D18; K04 → D21; K05, K17, K18 → D22.

## Hub-wide issues

Same structure in every hub page, so a fix here alone would make this page differ from the others. To be fixed in one pass across all repositories (the same IDs are used in every repository's docs).

| # | Issue | Seen in | Gas-Power status |
|---|---|---|---|
| H01 | Mobile: two divider lines between the header and the tabs | live-greekpower; Flows fixed it as pilot (D25) | To check (Phase 3) |
| H02 | Header labels on mobile: short labels ("Updated:" / "Next:", "Ενημέρωση:" / "Επόμενη:") | Flows, live-greekpower (only "Next") | **Done** *(existing)*; they do not yet fit one line (K17) |
| H05 | Mobile height: the status pill on its own line | Flows, live-greekpower | Replaced by H06 |
| H06 | Mobile: the secondary controls (date, pill, methodology, language) are not told apart from the main ones (tabs) and take much height | BESS pilot (26 Oct 2026, content from 585 to 407 px) | Open (Phases 3 and 6) |

## Hub conventions

Rules that every hub page should follow; checked in each repository during the hub-wide pass.

| # | Convention | Gas-Power status |
|---|---|---|
| C01 | **Main title** is the dashboard's name: a capital on every word except articles and conjunctions; **everything else** in Greek has a capital on the first word only | Main title ✓ (hub list, 20 Oct 2026); tab and card headings: Phase 4 (K07) |
| C02 | **No all-caps labels.** Captions are written normally, small and grey; numbers carry the colour and weight; units are never uppercased | **42 classes** (K07): Phase 4 |
