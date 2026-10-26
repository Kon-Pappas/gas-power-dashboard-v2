# Known issues

Open problems found in the review of 26 October 2026, when the alignment with the other hub dashboards began. Each item says what is wrong, why it matters and where it is planned (see `ROADMAP.md`). Resolved items are moved to `DECISIONS.md`.

| # | Issue | Why it matters | Plan |
|---|---|---|---|
| K01 | The loading overlay is the old kind: a percentage on every step, each starting at 0 %. The hub pattern shows all steps from the start at half opacity, with no percentage, and step 1 follows the real download of `meta.json` and `historical.json` | A different first impression from the other dashboards; it is also in English while the data load, even when the visitor saved Greek (D15) | Batch 3 (Phase 1) |
| K04 | Data colours clash with the accent and with the green rule. **Blue as data:** `#3b82f6` appears 7 times in `dashboard.js` (class F bars and rows, the HGSIDA line, the surplus bars) and four elements of `index.html` keep `blue-*` as data (the HGSIDA value, the *Max Efficiency* card with its bar, the monthly surplus value). **Green as data:** the Fleet Efficiency is emerald in the card, the table values and the line (`#10b981`). The other greens are right (*Complete Data*, *Best Grid Cost*) or belong to the loading overlay (K01) | A reader cannot tell decoration from data; green is used for a measured value | Phase 2 |
| K05 | Shell: the day and the month have separate boxes; the header and the boxes switch to the mobile layout at 1024 px (`lg`) while the tabs switch at 768 px (`md`), so between 768 and 1023 px the page is a mixture; there is no box for the secondary controls and no up-arrow (H06) | Different from BESS and Flows; the mixture looks unfinished on tablets | Phase 3 (decision on 768 px pending) |
| K06 | The Methodology modal has no Esc key, no focus handling and no `aria-modal`; the page scrolls behind it | Keyboard and screen-reader users | Phase 3 |
| K07 | Texts: 42 all-caps classes (20 in `index.html`, 4 in `dashboard.js`, 18 in `data.js`, the last ones being the Methodology headings), four capital column headings (FACTORY, PRODUCED, EFFICIENCY, COST), an emoji in four card labels and in the status pill, tab titles with a capital on every word. The tab label in the static HTML ("System Needs (Surplus)") differs from the one the page writes ("Generic Constraints & Surplus"), seen only without JavaScript | C02 and C01 of the hub; the Greek page also needs accents everywhere | Phase 4 (emoji: decision pending) |
| K08 | The Greek page is not fully Greek: five chart legends are English only (*HGSIDA Gas Price*, *Avg Fleet SRMC*, *Fleet Efficiency*, *Residual Energy Surplus*, *Generic Constraints (Out of Merit)*); the three charts use the default Chart.js tooltips | Rule "Greek page 100 % Greek"; the tooltips are the one place where the numbers are read | Phases 4 and 5 |
| K09 | The cost table on phones scrolls horizontally inside its wrapper, hides three columns below 640 px and shows the rest of each unit in an accordion; the hub pattern is cards with the numbers aligned right | Horizontal scrolling competes with the gestures of the phone. The accordion with the greyed other rows was kept by the owner in September 2026, so cards or accordion is a decision | Phase 6 (decision pending) |
| K10 | The Surplus tab calculates the constrained MWh **in the browser** (`dashboard.js`, about lines 861–908): it matches unit names, sums the hourly SCADA inside the constraint hours and leaves out the days without SCADA. The hourly SCADA is read only here and is 46 % of the compressed data file | Hub rule: Python calculates, the page only shows. The unit-name matching is where the Elpedison error hid for months. Calculated in Python, the page would not need the hourly SCADA (see K11) | Before Phase 7 (decision pending) |
| K11 | **Size of the data (measured 26 Oct 2026):** 147 days = 2,670 KB raw (`indent=2`), **226 KB gzip** (level 6; 209 KB at level 9), growing about 1.55 KB/day gzip; the limit of **250 KB gzip is reached in about 15 days**. Composition of the compressed file: hourly SCADA 46 %, daily economics 30 %, ISP 8 %, DAM 8 %, daily SCADA 6 %, the rest 3 %. The page downloads the whole file at every visit (`?v=<time>`) | Past the limit a visitor on a poor connection waits for the download, not for the processor | Phase 7; measure with a `scripts/data_size.py` as in BESS (to add); K10 may move the limit out by months |
| K12 | **Clock-change days.** `process_scada` reads a fixed 24 hour columns (`range(2, 26)`) and `process_dam` 24 prices. On **25 Oct 2026 (25 hours)** the 25th hour is lost; on **28 Mar 2027 (23 hours)** the SUM column may be read as an hour and double the day. **Not yet checked with the real files** (DAM of 25 Oct published on 24 Oct, SCADA published on 26 Oct about 06:05) | A wrong day in the economics and in the charts | Dated check in `ROADMAP.md`, then a batch |
| K13 | A missing value is written as `0.0` (hourly SCADA, DAM prices), not `null` | A missing hour looks like a real zero | With K12 |
| K14 | Three bare `except:` (in `fetch_excel`, `process_henex`, `process_dam`) swallow every error without a trace | A failed download or a changed file format leaves no sign in the log | With K12 |
| K15 | `process_dam` skips a day that already has a record, so a wrong record (for instance the 25-hour day cut to 24) never repairs itself | Errors in the day-ahead prices stay for good | With K12 |
| K16 | **CO₂ history.** 1 Jun – 23 Aug 2026 is the flat €85.00 estimate. Real prices from 24 Aug were written by the old by-date lookup until the end of September 2026 and can be shifted by one day (up to about €2/t); the owner decided not to re-fetch them (the free tier has 50 requests a month). The price of the latest call may be the previous close | A small, documented difference in the cost of past days | Accepted; written in the Methodology |
| K17 | The two header labels on phones (*Updated* / *Next*) do not fit one line: **measured 26 Oct 2026:** with the date as `dd/mm/yyyy hh:mm` they need 347 px in English and 400 px in Greek, against 328 px available at 360 px and 288 px at 320 px (the same before batch 1). Without the year they need 271 px in English (fits at 360 and 320) and 325 px in Greek (fits at 360, not at 320) | The owner's aim was both on one line; space on phones is precious | Phase 3 (date format on phones: decision pending) |
| K18 | The status pill (*Complete Data* / *Pending SCADA*) sticks out of the date box and of the screen: **measured 26 Oct 2026:** the page is 364 px wide at 360 px in Greek (+4), 354 px at 320 px in English (+34) and 364 px in Greek (+44); the same before batch 1 | The hub rule is no horizontal overflow at 360 and 320 px | Phase 3 (H06: pill inside the box) |
| K19 | The workflow installs the five packages of `requirements.txt` at fixed versions, but not their dependencies. **26 Oct 2026:** the run installed `python-dateutil 3.0.0` (the run of 27 Sep: 2.9.0.post0), a new major version, with pandas 2.2.1; it passed | A new version of a dependency can break the update without any change in the repository | A full list of pinned versions (decision pending) |

Resolved: K02 → D15; K03 → D14 (the remaining uses of green are in K04 and K01).

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
