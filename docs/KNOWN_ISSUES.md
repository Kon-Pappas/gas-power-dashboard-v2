# Known issues

Open problems found in the review of 26 October 2026, when the alignment with the other hub dashboards began. Each item says what is wrong, why it matters and where it is planned (see `ROADMAP.md`). Resolved items are moved to `DECISIONS.md`.

| # | Issue | Why it matters | Plan |
|---|---|---|---|
| K09 | The cost table on phones scrolls horizontally inside its wrapper, hides three columns below 640 px and shows the rest of each unit in an accordion; the hub pattern is cards with the numbers aligned right | Horizontal scrolling competes with the gestures of the phone. The accordion with the greyed other rows was kept by the owner in September 2026, so cards or accordion is a decision | Phase 6 (decision pending) |
| K10 | The Surplus tab calculates the constrained MWh **in the browser** (`dashboard.js`, about lines 861–908): it matches unit names, sums the hourly SCADA inside the constraint hours and leaves out the days without SCADA. The hourly SCADA is read only here and is 46 % of the compressed data file | Hub rule: Python calculates, the page only shows. The unit-name matching is where the Elpedison error hid for months. Calculated in Python, the page would not need the hourly SCADA (see K11) | Before Phase 7 (decision pending) |
| K11 | **Size of the data (measured 26 Oct 2026, after D16):** 148 days = 2,595 KB raw (`indent=2`), **211 KB gzip** (level 6; 227 KB before the removal of the day-ahead prices), growing about 1.45 KB/day gzip; the limit of **250 KB gzip is reached in about 27 days**. Composition of the compressed file: hourly SCADA 49.5 %, daily economics 32 %, ISP 8 %, daily SCADA 6.5 %, the rest 4 %. The page downloads the whole file at every visit (`?v=<time>`) | Past the limit a visitor on a poor connection waits for the download, not for the processor | Phase 7; K10 is the larger saving (the hourly SCADA is half of the file); measure with a `scripts/data_size.py` as in BESS (to add) |
| K13 | A blank cell of the hourly SCADA is written as `0.0`, not `null` | A missing hour looks like a real zero | Decision pending |
| K14 | Two bare `except:` (in `fetch_excel` and `process_henex`) swallow every error without a trace | A failed download or a changed file format leaves no sign in the log | Decision pending |
| K16 | **CO₂ history.** 1 Jun – 23 Aug 2026 is the flat €85.00 estimate. Real prices from 24 Aug were written by the old by-date lookup until the end of September 2026 and can be shifted by one day (up to about €2/t); the owner decided not to re-fetch them (the free tier has 50 requests a month). The price of the latest call may be the previous close. On 26 Oct 2026 the backfills also removed 7 empty placeholders (`CO2_Price: None` for 24, 25 and 30 Aug and 6, 7, 13 and 14 Sep); those days already used the €85.00 estimate, so no figure changed | A small, documented difference in the cost of past days | Accepted; written in the Methodology |
| K19 | The workflow installs the five packages of `requirements.txt` at fixed versions, but not their dependencies. **26 Oct 2026:** the run installed `python-dateutil 3.0.0` (the run of 27 Sep: 2.9.0.post0), a new major version, with pandas 2.2.1; it passed | A new version of a dependency can break the update without any change in the repository | A full list of pinned versions (decision pending) |
| K20 | **Clock-change days and the hours of a constraint.** The hours of a Generic Constraint (from the ISP2 file) are matched with the SCADA hours of the same day by number. On a 25- or 23-hour day the hours after the clock change can differ by one between the two (the ISP2 file may use CET like HEnEx, or Greek time: **not yet checked**). 25 Oct 2026 had no gas constraint, so nothing was affected; the next such day is 28 Mar 2027 | A constraint can be given one hour off on two days a year | The ISP2 file of 25 Oct was checked on 26 Oct 2026: its *GenericConstraints* sheet has only Alouminio, with a full-day window, so it does not settle the question. To check with the first file that has a gas constraint on a clock-change day, before 28 Mar 2027 |
| K22 | **Two cards of the economics row are still a few pixels too wide:** measured 27 Oct 2026 with the 25 Oct data, after the double € of *Total estimated cost* was removed (D26): the € of that card ends **3 px** beyond the screen at 1024 px (page 1027 px wide), and the *estimated* badge of the CO2 price ends **7 px** beyond the screen at 320 px (page 327 px wide, in English). A wrap of the badge fixes the width but moves the number 20 px out of line with its neighbours, so it was not applied | A page that scrolls sideways by a few pixels on tablets in landscape and on the narrowest phones | Phase 6 (the KPI row), for example the badge next to the label and smaller figures from 1024 to 1279 px |
| K25 | **The class table has no source in the repository:** `thermal_efficiency` in `historical.json` (H-Class 0.62, F-Class 0.56–0.58, Older Generation & Peakers 0.48–0.525) is not produced by `update_data.py`; the owner compiled it from separate public sources on the web. It is a second list of assumptions beside `PLANT_SPECS` (the cost model) and two units are above the maximum efficiency of the cost model (ΘΗΣ ΗΡΩΝ 0.58 against 0.575, ΜΕΓΑΛΟΠΟΛΗ 5 0.58 against 0.57); it only decides the class, the colour and the order of a unit | Two lists kept apart can drift; the Methodology states the reservation (D24) | Phase 7 (data): decide whether the class should be generated from `PLANT_SPECS` |

Resolved: K02 → D15; K03 → D14 (the remaining uses of green are in K04 and K01); K12 → D17 (SCADA) and D16 (day-ahead prices); K15 → D16; K01 → D20; K21 → D18; K04 → D21; K05, K17, K18 → D22; K06 → D23; K23 → D24; K07, K08, K24 → D25; K26 → D26.

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
