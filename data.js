// =========================================================================
// DATA FETCHING & NORMALIZATION (data.js) - SERVERLESS ARCHITECTURE
// =========================================================================

// Πλέον το dashboard διαβάζει απευθείας το παραγόμενο JSON αρχείο
const API_URL = "data/historical.json"; 

let rawData = { 
    isp: [], 
    scada: [], 
    constrained: null,   // D29: τα MWh των περιορισμών, υπολογισμένα από το Python (null = το αρχείο δεν τα έχει ακόμα) 
    henex: [], 
    efficiency: [],
    daily_surplus: [],          
    daily_economics: [],
    dayStatus: null        // D46 (K37): η κατάσταση κάθε ημέρας από το Python, ανά ημερομηνία (null = το αρχείο δεν έχει ακόμα day_status)
};

let currentLang = 'en';
let appReady = false;   // true όταν ζωγραφιστούν όλα τα tabs στην εκκίνηση (D20): μέχρι τότε το setLang δεν ξαναζωγραφίζει
// D15 (όπως BESS D04 / Flows): αγγλικά από προεπιλογή· η τελευταία επιλογή του επισκέπτη κρατιέται στον browser του,
// στο κοινό κλειδί kp_lang (ίδια προέλευση σε όλο το hub), οπότε η γλώσσα τον ακολουθεί από σελίδα σε σελίδα.
try { const l = localStorage.getItem('kp_lang'); if (l === 'el' || l === 'en') currentLang = l; } catch (e) { /* ιδιωτική περιήγηση */ }

const i18n = {
    en: {
        title: "Greek Gas-to-Power Market Analytics",
        load: { title: "System Initialization", g1: "Data fetching", g2: "Building views", s1: "Reading the data", ready: "Dashboard is ready!", error: "The data could not be loaded. Reload the page in a few minutes." },
        source: "Data source: IPTO (ADMIE) & HEnEx official reports",
        scopeTooltip: "Refers exclusively to natural gas fired power plants (CCGT/OCGT) in the Greek Interconnected System.",
        lastUpdate: "Last Update:",
        nextUpdate: "Next Update:",
        lastUpdateMobile: "Updated:",
        nextUpdateMobile: "Next:",
        dateLabel: "Date:",
        tabOverview: "Daily overview",
        tabEconomics: "Daily economics",
        tabIspScada: "Monthly analytics",
        tabSurplus: "Generic constraints & surplus",
        tabReview: "Daily review",
        revCompare: "Compare with",
        revPrev: "Previous day",
        rev7d: "7-day mean",
        revTitle: "Daily review",
        revKpiCost: "Fleet cost",
        revKpiGen: "Gas generation",
        revKpiSrmc: "Average fleet SRMC",
        revKpiEff: "Fleet efficiency (model)",
        revKpiGas: "gas",
        revMEur: "M €",
        revKEur: "k €",
        revPts: "pts",
        revFxTitle: "What moved the cost",
        revFxSub: "Exact split of the change, no remainder",
        revFx: {"vol": "Generation volume", "gas": "Gas price (HGSIDA)", "co2": "CO2 price (effect in euros)", "mix": "Efficiency / unit mix"},
        revFxTotal: "Total change",
        revDayTitle: "Events of the day",
        revDaySub: "Units out, returns and generic constraints",
        revOut: "Out of operation",
        revReturns: "Returns",
        revCons: "Generic constraints",
        revNone: "none",
        revDay1: "day",
        revDays: "days",
        revAfter: "after {n} days",
        revFirstDay: "First-day output",
        revUnitsTitle: "Which units brought the change",
        revUnitsSub: "Sorted by their effect on the cost (green = cheaper, red = dearer). The colour on the left is the unit class.",
        revConShort: "constraint",
        revNoOutput: "no output",
        revVsMedian: "vs 30d median",
        revVsMedianTip: "Compared with the median efficiency of this unit over its previous 30 days with production",
        mbCmpTitle: "The month against the previous one",
        mbCmpTitleSingle: "The month in numbers",
        mbCmpSubSingle: "{m} ({n} days), per day on average",
        mbCmpSub: "{m} ({n} days) against {p} ({q} days), per day on average",
        mbColMetric: "Metric",
        mbColChange: "Change",
        mbGas: "Gas (GWh thermal / day)",
        mbCost: "Fleet cost (M € / day)",
        mbGen: "Generation (GWh / day)",
        mbEff: "Fleet efficiency (%)",
        mbHg: "HGSIDA (€/MWh)",
        mbCo2: "CO2 emissions (t / day)",
        mbFxTitle: "What moved the cost in the month",
        mbFxSub: "Change of the cost per day, exact split",
        mbFxTotal: "Total change per day",
        mbFxNote: "Main factor: {f} ({v}), then {g} ({w}).",
        mbNoPrev: "There is no previous month in our history for this comparison.",
        mbNoMonth: "There are no review figures for this month yet.",
        mbAvailTitle: "Availability of the units",
        mbAvailSub: "Daily output of each unit. Dark = out, brighter = higher output of the same unit. A frame marks a return after at least 3 days out.",
        mbEvents: "Events of the month",
        mbNoEvents: "No returns or long outages.",
        mbRet: "returned after {n} days",
        mbOutEnd: "out at the end of the month: {n} days",
        mbPlusNote: "“N+”: out since the start of our history ({first}).",
        mbLegOut: "out",
        mbLegOn: "producing (colour = class)",
        mbLegRet: "return after 3+ days out",
        mbLegNoData: "no data",
        mbHeatAria: "Daily output of each unit in {m}",
        cbTitle: "Effect of the constraints per unit",
        cbSub: "{m} · load from the SCADA, efficiency modelled · inside = the hours of the constraint, outside = the other hours of the same days",
        cbKGen: "Generation in constraint hours",
        cbKGas: "Extra gas from the lower efficiency",
        cbKGasUnit: "GWh thermal",
        cbKVal: "Value at the HGSIDA (no CO2)",
        cbColUnit: "Unit",
        cbColDays: "Days",
        cbColMwh: "MWh in constraint",
        cbColShare: "% of output of those days",
        cbColLoad: "Load MW (in / out)",
        cbColEff: "Efficiency (in / out)",
        cbColDelta: "Δ pts",
        cbColGas: "Extra gas GWh",
        cbColVal: "Value k €",
        cbHoursShort: "h",
        cbNone: "No generic constraint in this month.",
        cbNote: "A negative change means that the constraint lowered the efficiency of the unit. The efficiency is modelled, so the size of the effect depends on the part-load assumption (see the Methodology).",
        revShowAll: "Show all units ({n})",
        revShowTop: "Show fewer units",
        revLoading: "Loading the review…",
        revError: "The review data could not be loaded. The other tabs are not affected; please try again later.",
        revNoBase: "No comparison is available for this day (there is no previous day with economics in our history).",
        revFell: "fell",
        revRose: "rose",
        revS1: "Fleet cost {dir} by {x} M € ({p}%) against {base}.",
        revS1Same: "Fleet cost was almost unchanged ({p}%) against {base}.",
        revS2: "Main factor: {f} ({v}{extra}).",
        revS3: "Then: {list}.",
        revAnd: "and",
        revBasePrev: "the previous day ({date})",
        revBase7: "the mean of the previous {n} days",
        revPh: {"vol": ["lower generation", "higher generation", "generation volume"], "gas": ["a cheaper gas price", "a dearer gas price", "the gas price"], "co2": ["a lower CO2 price", "a higher CO2 price", "the CO2 price"], "mix": ["better efficiency / unit mix", "worse efficiency / unit mix", "efficiency / unit mix"]},
        btnMethodology: "Methodology & Assumptions",
        btnMethodologyShort: "Methodology",
        methodLink: "Methodology →",
        toTop: "Back to top: date, methodology and tabs",
        lblTotalIsp: "Total ISP (MWh)",
        lblTotalScada: "Total SCADA (MWh)",
        ttlOverview: "Daily generation: ISP vs SCADA",
        subOverview: "Units sorted by efficiency class",
        lgdClasses: "Thermal classes",
        lgdOlder: "Older generation & peakers",
        lgdDataType: "Data type",
        lgdIspSolid: "ISP (solid)",
        lgdScadaStriped: "SCADA (striped)",
        lblHgsida: "HGSIDA price",
        lblCo2: "CO2 emissions",
        lblFleetEff: "Fleet efficiency",
        lblAvgSrmc: "Average fleet SRMC",
        lblGasGen: "Gas generation",
        lblTotalCost: "Total estimated cost",
        ttlEcoTable: "Daily theoretical cost per unit",
        subEcoTable: "SRMC = (HGSIDA / dynamic efficiency) + (dynamic CO2 factor × EUA price), with hourly load interpolation. Cost = SRMC × MWh.",
        thUnit: "Unit",
        thOutput: "Output (MWh)",
        thEff: "Efficiency",
        thCo2: "CO2 (t)",
        thSrmc: "SRMC",
        thCost: "Cost (€)",
        lblHighSrmc: "Highest fleet SRMC",
        lblLowSrmc: "Lowest fleet SRMC",
        lblLowEff: "Lowest efficiency",
        lblHighEff: "Highest efficiency",
        dayWord: "Day",
        ttlMonthly: "Monthly market and fleet performance",
        subMonthly: "Gas price, fleet SRMC and fleet efficiency, one point per day",
        legHgsida: "HGSIDA gas price",
        legSrmc: "Average fleet SRMC",
        legEff: "Fleet efficiency",
        axisDay: "Day of month",
        axisCost: "Cost (€/MWh)",
        axisEff: "Efficiency (%)",
        lblMonthSurplus: "Monthly residual surplus (ISP)",
        lblMonthConstraints: "Monthly constraint-driven generation (SCADA)",
        ttlSurplus: "Residual surplus vs constraint-driven generation",
        subSurplus: "Daily values from the ISP and the hourly SCADA",
        legSurplus: "Residual surplus (ISP)",
        legConstraints: "Constraint-driven generation (SCADA)",
        legIsp: "Scheduled (ISP)",
        legScada: "Actual (SCADA)",
        tipDev: "Deviation (SCADA − ISP)",
        tipNoMove: "No generation scheduled or recorded.",
        tipScadaPending: "SCADA is not published yet for this day.",
        tipNoData: "No data for this day.",
        tipNoSurplus: "No surplus and no constraint-driven generation.",
                lgdDayTotals: "Day total (MWh)",
        ecoMissBoth: "The economics of the day need the SCADA output and the HGSIDA price. Both are still missing: they are published the next day.",
        ecoMissScada: "The economics of the day need the SCADA output, which has not been published yet (it comes the next morning).",
        ecoMissHgsida: "The economics of the day need the HGSIDA price, which has not been published yet (it comes the next day, around midday).",
        ecoMissCalc: "The economics of this day have not been calculated yet: the next update will complete them.",
        ecoMissOld: "There are no economics for this day in our history.",
        revMissBoth: "The review needs the economics of the day, that is the SCADA output and the HGSIDA price. Both are still missing: they are published the next day.",
        revMissScada: "The review needs the economics of the day, that is the SCADA output, which has not been published yet (it comes the next morning).",
        revMissHgsida: "The review needs the economics of the day, that is the HGSIDA price, which has not been published yet (it comes the next day, around midday).",
        revMissCalc: "The review needs the economics of the day, which have not been calculated yet: the next update will complete them.",
        revMissOld: "There are no economics for this day in our history, so there is no review either.",
        locale: "en-GB",
        today: "today",
        monthLabel: "Month:",
        pillComplete: "Complete data",
        pillCompleteShort: "Complete",
        pillPending: "Pending SCADA",
        pillPendingShort: "Pending",
        revGoLatest: "Show the latest day with data ({date})",
        pillHgsida: "Waiting for HGSIDA",
        pillHgsidaShort: "Awaiting",
        pillNoEco: "No economics",
        pillNoEcoShort: "No data",
        btnClose: "Close",
        modalTitle: "Methodology, assumptions and limitations",
        btnShort: "Short",
        btnDetailed: "Detailed",
        modalBodyShort: `
            <p class="mb-3">An independent tool for monitoring natural gas power plants in the Greek market, built on open data. Figures are estimates and indications, not official statistics.</p>

            <h3 data-sec="all" class="mt-4 mb-2 text-xs font-bold text-acc-400">All tabs</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Scope:</strong> gas-fired (CCGT) units on the Transmission System (IPTO/ADMIE) that appear in its files. Lignite units (e.g. Ptolemaida5) and large hydro (e.g. Agras) are excluded even where present in the same source files.</li>
                <li><strong class="text-slate-200">Sources:</strong> IPTO/ADMIE (ISP = IPTO's scheduling of the 24 hours: ISP1 is the first run, around 18:00 the day before, and ISP2 the second, around midnight of the same day, which is the one used here; SCADA = actual operation, published the next morning), HEnEx (gas price indices) and OilPriceAPI (EU carbon price, used only as an input of the CO2 cost: the price itself is not shown). Updated twice daily (07:06 and 13:00, Greek time); the last 10 days are re-checked to catch late publications.</li>
                <li><strong class="text-slate-200">Pending data:</strong> a day with no SCADA yet is marked "Pending SCADA" and shown using ISP only. A day with no HGSIDA yet has its economics deferred to the next run rather than shown incomplete. The pill next to the date shows the case: "Complete data", "Pending SCADA", "Waiting for HGSIDA" or "No economics".</li>
                    <li><strong class="text-slate-200">Disclaimer:</strong> This dashboard is for information only and is not investment advice.</li>
    </ul>

            <h3 data-sec="overview" class="mt-4 mb-2 text-xs font-bold text-acc-400">Daily overview</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> the ISP shows what was scheduled, SCADA what actually happened. Differences between them are expected.</li>
                <li><strong class="text-slate-200">Totals and chart:</strong> the two totals add up the gas units of the selected day (Alouminio included). Solid bar = ISP, striped bar = SCADA. A day with no SCADA yet shows ISP only.</li>
                <li><strong class="text-slate-200">Classes:</strong> units are grouped by an assumed efficiency into H-Class (Super-Efficient, 2 units), F-Class (Standard, 8) and Older generation &amp; peakers (3). The grouping is the analyst's, compiled from public web sources, and is given with reservations.</li>
            </ul>

            <h3 data-sec="economics" class="mt-4 mb-2 text-xs font-bold text-acc-400">Daily economics</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Cost model:</strong> a theoretical cost, not realized revenue — one reference gas index (HGSIDA, the day-ahead price traded on that date) and a standardized CO2 cost per unit class.</li>
                <li><strong class="text-slate-200">CO2 price:</strong> the EU carbon price is an input of the CO2 cost and is not shown on the page. It is an indicative EU ETS spot price as collected by OilPriceAPI (from market makers, not the official ICE settlement), rounded to €0.5/t and used as an estimate. When a real price isn't available, we use the last known real price (weekends) or a flat €85.00 (if none exists); such days are marked as estimated in the data.</li>
                <li><strong class="text-slate-200">SRMC:</strong> short-run marginal cost — the fuel and CO2 cost of producing 1 MWh. The fleet average is the day's total cost divided by the day's MWh, i.e. weighted by output.</li>
                <li><strong class="text-slate-200">Efficiency:</strong> not a nameplate figure but the day's effective efficiency = MWh × HGSIDA ÷ fuel cost; it depends on how heavily the units were loaded.</li>
            </ul>

            <h3 data-sec="monthly" class="mt-4 mb-2 text-xs font-bold text-acc-400">Monthly analytics</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">What it shows:</strong> one point per day of the selected month, not monthly averages. Only days with complete economics (SCADA and HGSIDA) appear; the current month fills in day by day.</li>
            <li><strong class="text-slate-200">Boxes above the chart:</strong> the month against the previous one (per day, on average), what moved the cost in the month (the same exact split as in Daily review, on the per-day averages) and the availability of the units (units × days, with the returns of the month).</li>
                <li><strong class="text-slate-200">The three lines:</strong> HGSIDA price and average fleet SRMC (€/MWh, left axis) and fleet efficiency (%, right axis), as defined in Daily economics.</li>
                <li><strong class="text-slate-200">The line under the chart title:</strong> the extreme days of the month, with their date: highest and lowest average fleet SRMC and lowest and highest fleet efficiency. They change as days are added.</li>
        </ul>

            <h3 data-sec="surplus" class="mt-4 mb-2 text-xs font-bold text-acc-400">Generic constraints &amp; surplus</h3>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li><strong class="text-slate-200">Effect per unit:</strong> for each unit in a generic constraint this month: the MWh and the hours in the constraint, the load and the modelled efficiency inside against outside the constraint hours, and the extra gas that the lower efficiency costs.</li>
                <li><strong class="text-slate-200">Residual surplus (ISP):</strong> the daily value of the "Energy Surplus" row in IPTO's ISP2 file, in MWh. The page does not calculate it: IPTO writes it as a negative number and the page shows it as positive.</li>
                <li><strong class="text-slate-200">Monthly totals:</strong> the sum of the days shown in the chart.</li>
                <li><strong class="text-slate-200">Constraint-driven generation:</strong> the SCADA output of a gas unit during the hours IPTO's ISP2 lists it under a Generic Constraint. It approximates the residual ISP surplus; an imperfect proxy — the true surplus can't be independently verified.</li>
                <li><strong class="text-slate-200">Pending days excluded:</strong> only days without SCADA are left out of the chart; days with zero constraints or near-zero surplus stay in.</li>
        </ul>
            <h3 data-sec="review" class="mt-4 mb-2 text-xs font-bold text-acc-400">Daily review</h3><ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400"><li><strong class="text-slate-200">What it shows:</strong> what changed in the gas fleet on the selected day against the previous day or against the mean of the previous days.</li><li><strong class="text-slate-200">What moved the cost:</strong> the change of the fleet cost, split exactly into the volume of generation, the gas price, the CO2 price and the efficiency / mix of the units. The four add up to the total, with no remainder. The CO2 price is only an input: the page shows its effect in euros, not the price.</li><li><strong class="text-slate-200">Units:</strong> sorted by their effect on the cost; a unit with no output that day appears with 0 MWh.</li><li><strong class="text-slate-200">Out and returns:</strong> a unit is out when it produces up to 1 MWh a day; it returns when it produces more than 1 MWh after at least 3 days out. &quot;N+&quot; means out since the start of our history (<span data-first-day>1 Jun 2026</span>).</li></ul>
        `,
        modalBodyDetailed: `
            <p class="mb-3">This Dashboard is an independent tool for monitoring and analyzing natural gas power plants in the Greek Energy Market, built and maintained by a single analyst, on open data. Figures are estimates and indications, not official statistics.</p>

            <h3 data-sec="all" class="mt-4 mb-2 text-xs font-bold text-acc-400">All tabs</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Scope:</strong> refers exclusively to natural gas (CCGT) power plants connected to the Transmission System (IPTO/ADMIE) that appear in its published files. Lignite units (e.g. Ptolemaida5) and large hydro (e.g. Agras) are excluded even when they appear in the same source files as the gas units. Co-generation units with locked 24/7 output (e.g. Alouminio) are likewise excluded from constraint tracking, since their output isn't market-responsive.</li>
                <li><strong class="text-slate-200">Sources:</strong> Data is fetched daily from IPTO's (ADMIE) official reports (ISP & SCADA) and HEnEx (NGAS gas price indices); the CO2 price comes from OilPriceAPI (EU carbon price, €/t), one request a day, and is used only as an input of the CO2 cost: this page does not show or republish it. ISP is IPTO's scheduling of the 24 hours: ISP1 is the first run (around 18:00 the day before) and ISP2 the second (around midnight of the same day); this page uses ISP2.</li>
                <li><strong class="text-slate-200">Updates:</strong> twice daily, at 07:06 and 13:00 Greek time, via a scheduled job. The last 10 days are re-checked on every run to catch late publications and corrections.</li>
                <li><strong class="text-slate-200">Data completeness:</strong> SCADA telemetry for a given day is published by IPTO the following morning; until then, that day is marked "Pending SCADA" and shown using ISP data only. Similarly, HEnEx publishes the HGSIDA index for a given day on the following day, by around midday; until it appears, that day's economics are deferred entirely to the next run rather than calculated with an incomplete or zero value. The pill next to the date says which case the day is in: "Complete data"; "Pending SCADA" (shown with ISP only); "Waiting for HGSIDA" (one of the last 3 days: the SCADA is in and the economics wait for the price); "No economics" (an older day for which there are no economics). In the Daily economics and Daily review tabs such a day shows which data are missing and a button to the latest day with data.</li>
                <li><strong class="text-slate-200">History and time:</strong> the data start on <span data-first-day>1 Apr 2026</span>. Times are Greek time; on the days the clock changes (23 or 25 hours) all hours of the day are read.</li>
                    <li><strong class="text-slate-200">Disclaimer:</strong> This dashboard is for information only and is not investment advice.</li>
    </ul>

            <h3 data-sec="overview" class="mt-4 mb-2 text-xs font-bold text-acc-400">Daily overview</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> the ISP shows what was scheduled, SCADA what actually happened. Differences between them are expected and often meaningful — large gaps can indicate last-minute re-dispatch or constraint activity.</li>
                <li><strong class="text-slate-200">Totals and chart:</strong> the two totals add up the gas units of the selected day (Alouminio included). Each unit has two bars: solid = ISP, striped = SCADA. A day with no SCADA yet shows ISP only.</li>
                <li><strong class="text-slate-200">Classes:</strong> units are grouped by an assumed efficiency into H-Class (Super-Efficient, 2 units), F-Class (Standard, 8) and Older generation &amp; peakers (3), and the chart sorts them by class. The grouping is the analyst's own, compiled from separate public sources on the web, and is given with reservations; it is not an official classification.</li>
            </ul>

            <h3 data-sec="economics" class="mt-4 mb-2 text-xs font-bold text-acc-400">Daily economics</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Economics & fuel cost:</strong> Production cost is theoretically calculated using the daily HEnEx gas spot index (HGSIDA), divided by the specific Thermal Efficiency of each unit class, plus the standardized CO2 emission cost. HGSIDA is used uniformly across all units and hours as a simplifying assumption — HEnEx publishes several distinct gas price indices (HGSIDA, HGMBI, HGMSI, HGSIWD), and there is no public data indicating which index, if any, actually applied to a given unit's gas procurement at a given time. The HGSIDA of a date is the day-ahead price traded on that date for delivery on the next gas day (the index of the file of that trading day); the dashboard uses it as the gas price of the same date, a known simplification: using the price traded the day before would lower the total fuel cost by about 0.5 % and move every price change one day later.</li>
                <li><strong class="text-slate-200">Dynamic fuel cost model:</strong> Fuel cost is not a single daily number per unit — it is recalculated separately for each hour, based on that hour's actual SCADA output. Each unit has an assumed technical minimum and nameplate maximum (MW), and an assumed efficiency and CO2 intensity at each of those two points. For a given hour, the model locates the unit's actual output linearly between its minimum and maximum, and uses that same position to linearly interpolate both its efficiency and its CO2 emission factor for that hour — a unit running near its technical minimum is assumed less efficient (and more carbon-intensive per MWh) than the same unit running near full load. Hourly fuel cost is then HGSIDA divided by that hour's interpolated efficiency, multiplied by the hour's MWh; CO2 cost follows the same hourly logic. The key simplifying assumption is linearity: real CCGT heat-rate curves are typically non-linear, with efficiency gains concentrated closer to full load — this model treats the relationship as a straight line between the two known points, in the absence of publicly available, unit-specific heat-rate curves. For any unit without published technical specifications, a generic fallback profile is used instead of unit-specific values.</li>
                <li><strong class="text-slate-200">CO2 price & estimates:</strong> the EU carbon price (EUA, from OilPriceAPI) is used only as an input of the CO2 cost of each unit (tonnes × price); this page neither shows nor republishes it, and shows only the resulting costs and the emissions in tonnes. The price is an indicative EU ETS spot quote as collected by OilPriceAPI (aggregated from market makers, not the official ICE settlement); it is stored rounded to €0.5/t and used as an estimate. When a real price isn't available for a given date, the calculation deliberately defaults to the last known real price on weekends (the market is closed, so the previous real price is carried forward) or, if none exists at all, a flat placeholder (€85.00/t) — rather than leaving the calculation incomplete. Such days are marked as estimated in the data, and the estimate affects the CO2 cost of that day only.</li>
                <li><strong class="text-slate-200">SRMC:</strong> short-run marginal cost — the fuel and CO2 cost of producing 1 MWh. The fleet average is the day's total cost divided by the day's MWh, i.e. weighted by output.</li>
                <li><strong class="text-slate-200">Efficiency:</strong> not a nameplate figure but the day's effective efficiency = MWh × HGSIDA ÷ fuel cost. It follows from the hourly model above, so it depends on how heavily the units were loaded.</li>
                <li><strong class="text-slate-200">The numbers on the page:</strong> HGSIDA price (€/MWh); CO2 emissions of the fleet (t, from the modelled emission factors); fleet efficiency (%) as above; average fleet SRMC (€/MWh); gas generation (MWh) is the day's SCADA total; total estimated cost (€) is fuel plus CO2 for all units.</li>
                <li><strong class="text-slate-200">Table:</strong> per unit — output (MWh, from SCADA), effective efficiency, CO2 emissions (t), SRMC (€/MWh) and cost (€, for the whole day, not per MWh).</li>
            </ul>

            <h3 data-sec="monthly" class="mt-4 mb-2 text-xs font-bold text-acc-400">Monthly analytics</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">What it shows:</strong> one point per day of the selected month, not monthly averages. Only days with complete economics (SCADA and HGSIDA) appear; the current month fills in day by day.</li>
            <li><strong class="text-slate-200">Boxes above the chart:</strong> the month against the previous one uses the averages <em>per day</em> of the days that have economics (fleet efficiency is the total MWh over the total gas energy; the HGSIDA is the simple mean of those days; the CO2 is shown as emissions, never as a price). What moved the cost uses the same logarithmic-mean method as Daily review, on the per-day averages of the two months. In the availability map each cell is the daily output of a unit: dark = out (up to 1 MWh), brighter = higher output relative to the unit's own maximum of the month; a frame marks a return after at least 3 days out; &quot;N+&quot; means out since the start of our history.</li>
                <li><strong class="text-slate-200">The three lines:</strong> HGSIDA price and average fleet SRMC (€/MWh, left axis) and fleet efficiency (%, right axis), as defined in Daily economics.</li>
                <li><strong class="text-slate-200">The line under the chart title:</strong> the extreme days of the month, with their date: highest and lowest average fleet SRMC and lowest and highest fleet efficiency. They change as days are added to the current month.</li>
                <li><strong class="text-slate-200">How to read it:</strong> SRMC depends on the gas price, on the efficiency at which the units ran and on the CO2 price.</li>
                <li><strong class="text-slate-200">Days without a value:</strong> a day with a zero SRMC or efficiency (no valid calculation) is not counted among the lowest values of the cards.</li>
        </ul>

            <h3 data-sec="surplus" class="mt-4 mb-2 text-xs font-bold text-acc-400">Generic constraints &amp; surplus</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Out-of-Merit Operation:</strong> Due to the "duck curve" and high RES penetration, IPTO frequently keeps units synchronized via Generic Constraints for system stability. The dashboard takes the gas units and the hours of these constraints from the ISP2 schedule (its GenericConstraints sheet) and counts the unit's actual SCADA output inside those hours as constraint-driven generation (windows are counted in whole hours: a start or an end at a half hour is rounded down to the hour) — not market-driven arbitrage. Prices are not compared: a unit can also run below its cost for other reasons (technical minimum, block orders, balancing), and this view does not count those hours. In practice, this is the only available way to approximate the residual surplus left over from the ISP's scheduling, though it is an imperfect proxy, since the schedule is not a measurement and the true magnitude of that residual surplus cannot be independently verified from public data.</li>
                <li><strong class="text-slate-200">Which units count:</strong> only gas-fired units are tracked for constraints; lignite and large hydro units appearing in the same ISP file are filtered out, as is the co-generation unit with locked 24/7 output.</li>
            <li><strong class="text-slate-200">Effect per unit:</strong> only hours with output are used. &quot;Inside&quot; are the hours of the constraint and &quot;outside&quot; the other hours of the same days. The extra gas is the gas used inside the constraint minus what the same MWh would need at the efficiency that the unit has outside it; its value uses the HGSIDA of each day and does not include the CO2. The efficiency is modelled (as in Daily economics), so the size of the effect depends on the part-load assumption (k = 0.30, see Limitations); a negative change in points means that the constraint lowered the efficiency.</li>
                <li><strong class="text-slate-200">Pending days vs. zero days:</strong> a day is excluded from the chart only when SCADA isn't available yet for it. A day with SCADA but zero recorded constraints, or with very low residual surplus, remains in the chart and is shown as zero — it is not treated the same as a pending day.</li>
                <li><strong class="text-slate-200">Residual surplus (ISP):</strong> the daily value of the "Energy Surplus" row in IPTO's ISP2 file, in MWh. The page does not calculate it: IPTO writes it as a negative number and the page shows it as positive.</li>
                <li><strong class="text-slate-200">Monthly totals:</strong> the sum of the days shown in the chart (days with SCADA).</li>
                <li><strong class="text-slate-200">Two different quantities:</strong> the surplus is a figure of the schedule, whereas constraint-driven generation is actual output. They are compared as indications, not as a balance.</li>
        </ul>
            <h3 data-sec="review" class="mt-4 mb-2 text-xs font-bold text-acc-400">Daily review</h3><ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400"><li><strong class="text-slate-200">What it shows:</strong> what changed in the gas fleet on the selected day. It follows the date picker and is calculated from the economics of the day and from our own derived figures (<code>data/review.json</code>), which the page loads at start together with the other data files.</li><li><strong class="text-slate-200">Comparison:</strong> &quot;Previous day&quot; is the calendar day before and needs its economics; &quot;7-day mean&quot; is the mean, day by day, of up to 7 previous days that have economics (at least 3).</li><li><strong class="text-slate-200">What moved the cost:</strong> the change of the fleet cost is split with the logarithmic-mean (LMDI) method, which is exact and does not depend on the order of the factors. Volume is the effect of the change of total MWh; gas price and CO2 price are the effects of the change of the price paid per unit of gas and per tonne; efficiency / mix is the effect of the change of the gas and CO2 used per MWh produced, i.e. which units ran and how loaded. The four add up to the total with no remainder (rounded to whole euros). The CO2 price is an input of the calculation and is not shown: only its effect in euros is.</li><li><strong class="text-slate-200">Units:</strong> every unit that ran that day or in the comparison, sorted by the change of its cost (the changes add up to the change of the fleet cost). The efficiency is modelled, as in Daily economics, and is compared with the median of the unit's previous 30 days with production (at least 5).</li><li><strong class="text-slate-200">Out and returns:</strong> a unit is out when it produces up to 1 MWh a day and returns when it produces more than 1 MWh after at least 3 days out; &quot;N+&quot; means that the stretch starts at the beginning of our history (<span data-first-day>1 Jun 2026</span>), so the real length is longer. A gap in the dates breaks a stretch.</li><li><strong class="text-slate-200">Generic constraints:</strong> the unit, the window of its constraint in the IPTO ISP2 file (clock hours) and the MWh produced in those hours (hourly SCADA).</li><li><strong class="text-slate-200">Limits:</strong> the cost is theoretical, as in Daily economics; the effects are indications, not accounting.</li></ul>

            <h3 data-sec="limits" class="mt-4 mb-2 text-xs font-bold text-acc-400">Limitations</h3>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Data:</strong> SCADA data is published as preliminary/uncertified by IPTO and may be revised. The ISP is a schedule, not a measurement of actual delivery.</li>
                <li><strong class="text-slate-200">Cost model:</strong> relies on a single simplified gas price reference (HGSIDA) rather than unit-specific procurement data, and does not reflect each unit's actual realized revenue or market settlement.</li>
                <li><strong class="text-slate-200">Nature:</strong> this is an independent analysis of open data. It is not the official position of IPTO/ADMIE, HEnEx, or any other organisation.</li>
                <li><strong class="text-slate-200">Assumptions:</strong> each unit's minimum and maximum load, efficiency and CO2 emissions, and its class, are assumptions compiled from public sources on the web (e.g. ENTSO-E, IPTO), not measurements. They are the analyst's responsibility and are given with reservations.</li>
                <li><strong class="text-slate-200">Part-load efficiency:</strong> efficiency falls linearly from full load to the minimum load. The combined-cycle units of the F class lose the same share of their efficiency per unit of load below full load as the H class (about 30%: at half load a unit gives about 85% of its full-load efficiency); the older units keep their own values. The minimum loads of Thisvi, Thessaloniki, Heron and Megalopoli 5 were set where the hourly SCADA of each unit piles up. The real curves of the units are not known, and the units that run mostly near their minimum (Thisvi, Heron, Thessaloniki) are the most sensitive to this assumption.</li>
                <li><strong class="text-slate-200">What the cost leaves out:</strong> only fuel and CO2 are counted; other costs (e.g. operation and maintenance, start-ups, gas transport) are not included.</li>
            </ul>
        `
    },
    el: {
        title: "Ανάλυση Ελληνικής Αγοράς Φυσικού Αερίου",
        load: { title: "Εκκίνηση", g1: "Λήψη δεδομένων", g2: "Προετοιμασία προβολών", s1: "Ανάγνωση δεδομένων", ready: "Το dashboard είναι έτοιμο!", error: "Τα δεδομένα δεν φορτώθηκαν. Ανανεώστε τη σελίδα σε λίγα λεπτά." },
        source: "Πηγή δεδομένων: Επίσημα αρχεία ΑΔΜΗΕ (IPTO) & ΕΧΕ (HEnEx)",
        scopeTooltip: "Αφορά αποκλειστικά τις μονάδες ηλεκτροπαραγωγής από Φυσικό Αέριο (CCGT/OCGT) στο Διασυνδεδεμένο Σύστημα.",
        lastUpdate: "Τελευταία Ενημέρωση:",
        nextUpdate: "Επόμενη Ενημέρωση:",
        lastUpdateMobile: "Ενημερώθηκε:",
        nextUpdateMobile: "Επόμενη:",
        dateLabel: "Ημέρα:",
        tabOverview: "Ημερήσια επισκόπηση",
        tabEconomics: "Ημερήσια οικονομικά",
        tabIspScada: "Μηνιαία ανάλυση",
        tabSurplus: "Περιορισμοί & πλεόνασμα",
        tabReview: "Ανασκόπηση ημέρας",
        revCompare: "Σύγκριση με",
        revPrev: "Προηγούμενη ημέρα",
        rev7d: "Μέσος όρος 7 ημερών",
        revTitle: "Ανασκόπηση ημέρας",
        revKpiCost: "Κόστος στόλου",
        revKpiGen: "Παραγωγή αερίου",
        revKpiSrmc: "Μέσο SRMC στόλου",
        revKpiEff: "Απόδοση στόλου (μοντέλο)",
        revKpiGas: "αέριο",
        revMEur: "εκ. €",
        revKEur: "χιλ. €",
        revPts: "μον.",
        revFxTitle: "Τι κίνησε το κόστος",
        revFxSub: "Ακριβής διάσπαση της μεταβολής, χωρίς υπόλοιπο",
        revFx: {"vol": "Όγκος παραγωγής", "gas": "Τιμή αερίου (HGSIDA)", "co2": "Τιμή CO2 (επίδραση σε ευρώ)", "mix": "Απόδοση / μείγμα μονάδων"},
        revFxTotal: "Σύνολο μεταβολής",
        revDayTitle: "Συμβάντα της ημέρας",
        revDaySub: "Μονάδες εκτός, επιστροφές και generic constraints",
        revOut: "Εκτός λειτουργίας",
        revReturns: "Επιστροφές",
        revCons: "Generic constraints",
        revNone: "καμία",
        revDay1: "ημέρα",
        revDays: "ημέρες",
        revAfter: "μετά από {n} ημέρες",
        revFirstDay: "Παραγωγή πρώτης ημέρας",
        revUnitsTitle: "Ποιες μονάδες έφεραν την αλλαγή",
        revUnitsSub: "Ταξινομημένες κατά την επίδρασή τους στο κόστος (πράσινο = φθηνότερο, κόκκινο = ακριβότερο). Το χρώμα αριστερά είναι η κλάση της μονάδας.",
        revConShort: "constraint",
        revNoOutput: "χωρίς παραγωγή",
        revVsMedian: "vs διάμ. 30ημ.",
        revVsMedianTip: "Σε σύγκριση με τη διάμεση απόδοση της μονάδας στις προηγούμενες 30 ημέρες με παραγωγή",
        mbCmpTitle: "Ο μήνας έναντι του προηγούμενου",
        mbCmpTitleSingle: "Ο μήνας σε αριθμούς",
        mbCmpSubSingle: "{m} ({n} ημέρες), ανά ημέρα κατά μέσο όρο",
        mbCmpSub: "{m} ({n} ημέρες) έναντι {p} ({q} ημέρες), ανά ημέρα κατά μέσο όρο",
        mbColMetric: "Μέγεθος",
        mbColChange: "Μεταβολή",
        mbGas: "Αέριο (GWh θερμικά / ημέρα)",
        mbCost: "Κόστος στόλου (εκ. € / ημέρα)",
        mbGen: "Παραγωγή (GWh / ημέρα)",
        mbEff: "Απόδοση στόλου (%)",
        mbHg: "HGSIDA (€/MWh)",
        mbCo2: "Εκπομπές CO2 (t / ημέρα)",
        mbFxTitle: "Τι κίνησε το κόστος τον μήνα",
        mbFxSub: "Μεταβολή του κόστους ανά ημέρα, ακριβής διάσπαση",
        mbFxTotal: "Σύνολο μεταβολής ανά ημέρα",
        mbFxNote: "Κύριος παράγοντας: {f} ({v}), ακολουθεί {g} ({w}).",
        mbNoPrev: "Δεν υπάρχει προηγούμενος μήνας στο ιστορικό μας για αυτή τη σύγκριση.",
        mbNoMonth: "Δεν υπάρχουν ακόμα στοιχεία ανασκόπησης για αυτόν τον μήνα.",
        mbAvailTitle: "Διαθεσιμότητα μονάδων",
        mbAvailSub: "Ημερήσια παραγωγή κάθε μονάδας. Σκούρο = εκτός, φωτεινότερο = υψηλότερη παραγωγή της ίδιας μονάδας. Το πλαίσιο δείχνει επιστροφή μετά από τουλάχιστον 3 ημέρες εκτός.",
        mbEvents: "Γεγονότα του μήνα",
        mbNoEvents: "Καμία επιστροφή ή μακρά διακοπή.",
        mbRet: "επέστρεψε μετά από {n} ημέρες",
        mbOutEnd: "εκτός στο τέλος του μήνα: {n} ημέρες",
        mbPlusNote: "«N+»: εκτός από την αρχή του ιστορικού μας ({first}).",
        mbLegOut: "εκτός",
        mbLegOn: "παράγει (χρώμα = κλάση)",
        mbLegRet: "επιστροφή μετά από 3+ ημέρες εκτός",
        mbLegNoData: "χωρίς δεδομένα",
        mbHeatAria: "Ημερήσια παραγωγή κάθε μονάδας τον {m}",
        cbTitle: "Επίδραση των περιορισμών ανά μονάδα",
        cbSub: "{m} · φορτίο από το SCADA, απόδοση μοντελοποιημένη · μέσα = ώρες του περιορισμού, έξω = οι υπόλοιπες ώρες των ίδιων ημερών",
        cbKGen: "Παραγωγή σε ώρες περιορισμού",
        cbKGas: "Επιπλέον αέριο λόγω χαμηλότερης απόδοσης",
        cbKGasUnit: "GWh θερμικά",
        cbKVal: "Αξία στο HGSIDA (χωρίς CO2)",
        cbColUnit: "Μονάδα",
        cbColDays: "Ημέρες",
        cbColMwh: "MWh σε περιορισμό",
        cbColShare: "% παραγωγής αυτών των ημερών",
        cbColLoad: "Φορτίο MW (μέσα / έξω)",
        cbColEff: "Απόδοση (μέσα / έξω)",
        cbColDelta: "Δ μον.",
        cbColGas: "Επιπλέον αέριο GWh",
        cbColVal: "Αξία χιλ. €",
        cbHoursShort: "ώ",
        cbNone: "Κανένας generic constraint αυτό τον μήνα.",
        cbNote: "Αρνητική μεταβολή σημαίνει ότι ο περιορισμός μείωσε την απόδοση της μονάδας. Η απόδοση είναι μοντελοποιημένη, άρα το μέγεθος της επίδρασης εξαρτάται από την παραδοχή μερικού φορτίου (βλ. Μεθοδολογία).",
        revShowAll: "Εμφάνιση όλων των μονάδων ({n})",
        revShowTop: "Λιγότερες μονάδες",
        revLoading: "Φόρτωση της ανασκόπησης…",
        revError: "Δεν φορτώθηκαν τα δεδομένα της ανασκόπησης. Τα υπόλοιπα tabs δεν επηρεάζονται· δοκίμασε ξανά αργότερα.",
        revNoBase: "Δεν υπάρχει σύγκριση για αυτή την ημέρα (δεν υπάρχει προηγούμενη ημέρα με οικονομικά στο ιστορικό μας).",
        revFell: "έπεσε",
        revRose: "ανέβηκε",
        revS1: "Το κόστος του στόλου {dir} κατά {x} εκ. € ({p}%) σε σχέση με {base}.",
        revS1Same: "Το κόστος του στόλου έμεινε σχεδόν αμετάβλητο ({p}%) σε σχέση με {base}.",
        revS2: "Κύριος παράγοντας: {f} ({v}{extra}).",
        revS3: "Ακολουθούν: {list}.",
        revAnd: "και",
        revBasePrev: "την προηγούμενη ημέρα ({date})",
        revBase7: "τον μέσο όρο των προηγούμενων {n} ημερών",
        revPh: {"vol": ["η χαμηλότερη παραγωγή", "η υψηλότερη παραγωγή", "ο όγκος παραγωγής"], "gas": ["η φθηνότερη τιμή αερίου", "η ακριβότερη τιμή αερίου", "η τιμή αερίου"], "co2": ["η χαμηλότερη τιμή CO2", "η υψηλότερη τιμή CO2", "η τιμή CO2"], "mix": ["η καλύτερη απόδοση / το μείγμα μονάδων", "η χειρότερη απόδοση / το μείγμα μονάδων", "η απόδοση / το μείγμα μονάδων"]},
        btnMethodology: "Μεθοδολογία & Παραδοχές",
        btnMethodologyShort: "Μεθοδολογία",
        methodLink: "Μεθοδολογία →",
        toTop: "Επιστροφή επάνω: ημερομηνία, μεθοδολογία και tabs",
        lblTotalIsp: "Συνολικό ISP (MWh)",
        lblTotalScada: "Συνολικό SCADA (MWh)",
        ttlOverview: "Ημερήσια παραγωγή: ISP και SCADA",
        subOverview: "Μονάδες ταξινομημένες κατά κλάση απόδοσης",
        lgdClasses: "Κλάσεις μονάδων",
        lgdOlder: "Παλαιότερες και μονάδες αιχμής",
        lgdDataType: "Τύπος δεδομένων",
        lgdIspSolid: "ISP (συμπαγής)",
        lgdScadaStriped: "SCADA (διαγραμμισμένη)",
        lblHgsida: "Τιμή HGSIDA",
        lblCo2: "Εκπομπές CO2",
        lblFleetEff: "Απόδοση στόλου",
        lblAvgSrmc: "Μέσο SRMC στόλου",
        lblGasGen: "Παραγωγή αερίου",
        lblTotalCost: "Εκτιμώμενο συνολικό κόστος",
        ttlEcoTable: "Ημερήσιο θεωρητικό κόστος ανά μονάδα",
        subEcoTable: "SRMC = (HGSIDA / δυναμική απόδοση) + (δυναμικός συντελεστής CO2 × τιμή EUA), με ωριαία παρεμβολή του φορτίου. Κόστος = SRMC × MWh.",
        thUnit: "Μονάδα",
        thOutput: "Παραγωγή (MWh)",
        thEff: "Απόδοση",
        thCo2: "CO2 (t)",
        thSrmc: "SRMC",
        thCost: "Κόστος (€)",
        lblHighSrmc: "Υψηλότερο SRMC στόλου",
        lblLowSrmc: "Χαμηλότερο SRMC στόλου",
        lblLowEff: "Χαμηλότερη απόδοση",
        lblHighEff: "Υψηλότερη απόδοση",
        dayWord: "Ημέρα",
        ttlMonthly: "Μηνιαία πορεία αγοράς και στόλου",
        subMonthly: "Τιμή αερίου, SRMC και απόδοση στόλου, ένα σημείο ανά ημέρα",
        legHgsida: "Τιμή αερίου HGSIDA",
        legSrmc: "Μέσο SRMC στόλου",
        legEff: "Απόδοση στόλου",
        axisDay: "Ημέρα του μήνα",
        axisCost: "Κόστος (€/MWh)",
        axisEff: "Απόδοση (%)",
        lblMonthSurplus: "Μηνιαίο υπολειπόμενο πλεόνασμα (ISP)",
        lblMonthConstraints: "Μηνιαία παραγωγή λόγω περιορισμών (SCADA)",
        ttlSurplus: "Υπολειπόμενο πλεόνασμα και παραγωγή λόγω περιορισμών",
        subSurplus: "Ημερήσιες τιμές από το ISP και το ωριαίο SCADA",
        legSurplus: "Υπολειπόμενο πλεόνασμα (ISP)",
        legConstraints: "Παραγωγή λόγω περιορισμών (SCADA)",
        legIsp: "Πρόγραμμα (ISP)",
        legScada: "Πραγματικό (SCADA)",
        tipDev: "Απόκλιση (SCADA − ISP)",
        tipNoMove: "Καμία παραγωγή, ούτε στο πρόγραμμα ούτε στο SCADA.",
        tipScadaPending: "Το SCADA της ημέρας δεν έχει δημοσιευτεί ακόμα.",
        tipNoData: "Χωρίς δεδομένα για αυτή την ημέρα.",
        tipNoSurplus: "Κανένα πλεόνασμα ούτε παραγωγή λόγω περιορισμών.",
                lgdDayTotals: "Σύνολο ημέρας (MWh)",
        ecoMissBoth: "Τα οικονομικά της ημέρας χρειάζονται την παραγωγή SCADA και την τιμή HGSIDA. Λείπουν και τα δύο: δημοσιεύονται την επόμενη ημέρα.",
        ecoMissScada: "Τα οικονομικά της ημέρας χρειάζονται την παραγωγή SCADA, που δεν έχει δημοσιευτεί ακόμα (δημοσιεύεται το επόμενο πρωί).",
        ecoMissHgsida: "Τα οικονομικά της ημέρας χρειάζονται την τιμή HGSIDA, που δεν έχει δημοσιευτεί ακόμα (δημοσιεύεται την επόμενη ημέρα, γύρω στο μεσημέρι).",
        ecoMissCalc: "Τα οικονομικά αυτής της ημέρας δεν έχουν υπολογιστεί ακόμα: η επόμενη ενημέρωση θα τα συμπληρώσει.",
        ecoMissOld: "Για αυτή την ημέρα δεν υπάρχουν οικονομικά στο ιστορικό μας.",
        revMissBoth: "Η ανασκόπηση χρειάζεται τα οικονομικά της ημέρας, δηλαδή την παραγωγή SCADA και την τιμή HGSIDA. Λείπουν και τα δύο: δημοσιεύονται την επόμενη ημέρα.",
        revMissScada: "Η ανασκόπηση χρειάζεται τα οικονομικά της ημέρας, δηλαδή την παραγωγή SCADA, που δεν έχει δημοσιευτεί ακόμα (δημοσιεύεται το επόμενο πρωί).",
        revMissHgsida: "Η ανασκόπηση χρειάζεται τα οικονομικά της ημέρας, δηλαδή την τιμή HGSIDA, που δεν έχει δημοσιευτεί ακόμα (δημοσιεύεται την επόμενη ημέρα, γύρω στο μεσημέρι).",
        revMissCalc: "Η ανασκόπηση χρειάζεται τα οικονομικά της ημέρας, που δεν έχουν υπολογιστεί ακόμα: η επόμενη ενημέρωση θα τα συμπληρώσει.",
        revMissOld: "Για αυτή την ημέρα δεν υπάρχουν οικονομικά στο ιστορικό μας, άρα ούτε ανασκόπηση.",
        locale: "el-GR",
        today: "σήμερα",
        monthLabel: "Μήνας:",
        pillComplete: "Πλήρη δεδομένα",
        pillCompleteShort: "Πλήρη",
        pillPending: "Εκκρεμεί SCADA",
        pillPendingShort: "Εκκρεμεί",
        revGoLatest: "Δες την τελευταία ημέρα με δεδομένα ({date})",
        pillHgsida: "Αναμονή HGSIDA",
        pillHgsidaShort: "Αναμονή",
        pillNoEco: "Χωρίς οικονομικά",
        pillNoEcoShort: "Χωρίς δεδομένα",
        btnClose: "Κλείσιμο",
        modalTitle: "Μεθοδολογία, παραδοχές και περιορισμοί",
        btnShort: "Σύντομη",
        btnDetailed: "Αναλυτική",
        modalBodyShort: `
            <p class="mb-3">Ένα ανεξάρτητο εργαλείο παρακολούθησης μονάδων φυσικού αερίου στην Ελληνική Αγορά Ενέργειας, χτισμένο πάνω σε ανοιχτά δεδομένα. Τα νούμερα είναι εκτιμήσεις και ενδείξεις, όχι επίσημη στατιστική.</p>

            <h3 data-sec="all" class="mt-4 mb-2 text-xs font-bold text-acc-400">Όλα τα tabs</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Εύρος:</strong> μονάδες φυσικού αερίου (CCGT) στο Σύστημα Μεταφοράς (ΑΔΜΗΕ) που εμφανίζονται στα αρχεία του. Λιγνιτικές μονάδες (π.χ. Πτολεμαΐδα5) και μεγάλα υδροηλεκτρικά (π.χ. Άγρας) εξαιρούνται, ακόμα κι όταν εμφανίζονται στα ίδια αρχεία-πηγές.</li>
                <li><strong class="text-slate-200">Πηγές:</strong> ΑΔΜΗΕ (ISP = ο προγραμματισμός του ΑΔΜΗΕ για το 24ωρο: το ISP1 είναι ο πρώτος, γύρω στις 18:00 της προηγούμενης ημέρας, και το ISP2 ο δεύτερος, γύρω στα μεσάνυχτα της ίδιας ημέρας, που είναι αυτός που χρησιμοποιείται εδώ· SCADA = πραγματική λειτουργία, δημοσιεύεται το επόμενο πρωί), HEnEx (δείκτες τιμής αερίου) και OilPriceAPI (τιμή CO2 της ΕΕ, που χρησιμοποιείται μόνο ως είσοδος του κόστους CO2: η ίδια η τιμή δεν εμφανίζεται). Ενημέρωση δύο φορές την ημέρα (07:06 και 13:00, ώρα Ελλάδος)· οι τελευταίες 10 μέρες επανελέγχονται για καθυστερημένες δημοσιεύσεις.</li>
                <li><strong class="text-slate-200">Ελλιπή δεδομένα:</strong> μέρα χωρίς SCADA ακόμα σημειώνεται "Pending SCADA" και δείχνεται μόνο με ISP. Μέρα χωρίς HGSIDA ακόμα αναβάλλει τα economics για το επόμενο run, αντί να δείχνει ελλιπή εγγραφή. Το pill δίπλα στην ημερομηνία δείχνει την περίπτωση: «Πλήρη δεδομένα», «Εκκρεμεί SCADA», «Αναμονή HGSIDA» ή «Χωρίς οικονομικά».</li>
                    <li><strong class="text-slate-200">Αποποίηση ευθύνης:</strong> Το παρόν dashboard έχει ενημερωτικό χαρακτήρα και δεν αποτελεί επενδυτική συμβουλή.</li>
    </ul>

            <h3 data-sec="overview" class="mt-4 mb-2 text-xs font-bold text-acc-400">Ημερήσια επισκόπηση</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> το ISP δείχνει τι προγραμματίστηκε, το SCADA τι πραγματικά συνέβη. Διαφορές ανάμεσά τους είναι αναμενόμενες.</li>
                <li><strong class="text-slate-200">Σύνολα και γράφημα:</strong> τα δύο σύνολα αθροίζουν τις μονάδες αερίου της επιλεγμένης ημέρας (με το Αλουμίνιο). Συμπαγής μπάρα = ISP, διαγραμμισμένη = SCADA. Μέρα χωρίς SCADA δείχνει μόνο ISP.</li>
                <li><strong class="text-slate-200">Κλάσεις:</strong> οι μονάδες ομαδοποιούνται με βάση μια υποθετική απόδοση σε H-Class (Super-Efficient, 2 μονάδες), F-Class (Standard, 8) και Παλαιότερες και μονάδες αιχμής (3). Η ομαδοποίηση είναι του αναλυτή, συγκεντρωμένη από δημόσιες πηγές του διαδικτύου, και δίνεται με επιφύλαξη.</li>
            </ul>

            <h3 data-sec="economics" class="mt-4 mb-2 text-xs font-bold text-acc-400">Ημερήσια οικονομικά</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Μοντέλο κόστους:</strong> θεωρητικό κόστος, όχι πραγματικό έσοδο — ένας ενιαίος δείκτης αναφοράς αερίου (HGSIDA, η τιμή day-ahead που διαπραγματεύτηκε εκείνη την ημερομηνία) και τυποποιημένο κόστος CO2 ανά κλάση μονάδας.</li>
                <li><strong class="text-slate-200">Τιμή CO2:</strong> η τιμή CO2 της ΕΕ είναι είσοδος του κόστους CO2 και δεν εμφανίζεται στη σελίδα. Είναι ενδεικτική τιμή spot του EU ETS, όπως τη συλλέγει το OilPriceAPI (από market makers, όχι το επίσημο κλείσιμο του ICE), στρογγυλοποιημένη στα 0,5 €/t και χρησιμοποιούμενη ως εκτίμηση. Όταν δεν υπάρχει διαθέσιμη πραγματική τιμή, χρησιμοποιείται η τελευταία γνωστή πραγματική τιμή (Σαββατοκύριακα) ή σταθερή τιμή €85.00 (αν δεν υπάρχει καμία)· οι ημέρες αυτές σημειώνονται ως εκτιμήσεις στα δεδομένα.</li>
                <li><strong class="text-slate-200">SRMC:</strong> βραχυχρόνιο οριακό κόστος: το κόστος καυσίμου και CO2 για την παραγωγή 1 MWh. Το μέσο SRMC στόλου είναι το συνολικό κόστος της ημέρας διά τις MWh της, δηλαδή σταθμισμένο με την παραγωγή.</li>
                <li><strong class="text-slate-200">Απόδοση:</strong> δεν είναι ονομαστική τιμή αλλά η ενεργός απόδοση της ημέρας = MWh × HGSIDA ÷ κόστος καυσίμου· εξαρτάται από το πόσο φορτισμένες δούλεψαν οι μονάδες.</li>
            </ul>

            <h3 data-sec="monthly" class="mt-4 mb-2 text-xs font-bold text-acc-400">Μηνιαία ανάλυση</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Τι δείχνει:</strong> ένα σημείο ανά ημέρα του επιλεγμένου μήνα, όχι μηνιαίους μέσους όρους. Εμφανίζονται μόνο ημέρες με ολοκληρωμένα οικονομικά (SCADA και HGSIDA)· ο τρέχων μήνας γεμίζει μέρα με τη μέρα.</li>
            <li><strong class="text-slate-200">Boxes πάνω από το γράφημα:</strong> ο μήνας έναντι του προηγούμενου (ανά ημέρα, κατά μέσο όρο), τι κίνησε το κόστος τον μήνα (η ίδια ακριβής διάσπαση με την Ανασκόπηση ημέρας, στους μέσους όρους ανά ημέρα) και η διαθεσιμότητα των μονάδων (μονάδες × ημέρες, με τις επιστροφές του μήνα).</li>
                <li><strong class="text-slate-200">Οι τρεις γραμμές:</strong> τιμή HGSIDA και μέσο SRMC στόλου (€/MWh, αριστερός άξονας) και απόδοση στόλου (%, δεξιός άξονας), όπως ορίζονται στα Ημερήσια οικονομικά.</li>
                <li><strong class="text-slate-200">Η γραμμή κάτω από τον τίτλο του γραφήματος:</strong> οι ακραίες ημέρες του μήνα, με την ημερομηνία τους: υψηλότερο και χαμηλότερο μέσο SRMC στόλου, χαμηλότερη και υψηλότερη απόδοση. Αλλάζουν όσο προστίθενται ημέρες.</li>
        </ul>

            <h3 data-sec="surplus" class="mt-4 mb-2 text-xs font-bold text-acc-400">Περιορισμοί συστήματος &amp; πλεόνασμα</h3>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li><strong class="text-slate-200">Επίδραση ανά μονάδα:</strong> για κάθε μονάδα σε generic constraint τον μήνα: τα MWh και οι ώρες σε περιορισμό, το φορτίο και η μοντελοποιημένη απόδοση μέσα έναντι έξω από τις ώρες του περιορισμού, και το επιπλέον αέριο που κοστίζει η χαμηλότερη απόδοση.</li>
                <li><strong class="text-slate-200">Residual surplus (ISP):</strong> η ημερήσια τιμή της γραμμής «Energy Surplus» του αρχείου ISP2 του ΑΔΜΗΕ, σε MWh. Δεν την υπολογίζει η σελίδα· ο ΑΔΜΗΕ τη γράφει αρνητική και η σελίδα τη δείχνει θετική.</li>
                <li><strong class="text-slate-200">Μηνιαία σύνολα:</strong> το άθροισμα των ημερών που φαίνονται στο γράφημα.</li>
                <li><strong class="text-slate-200">Constraint-driven παραγωγή:</strong> η παραγωγή SCADA μονάδας αερίου τις ώρες που το ISP2 του ΑΔΜΗΕ την έχει σε Generic Constraint. Προσεγγίζει το residual surplus του ISP· ατελές proxy — το πραγματικό surplus δεν επαληθεύεται ανεξάρτητα.</li>
                <li><strong class="text-slate-200">Εξαιρούνται μόνο οι pending μέρες:</strong> μόνο μέρες χωρίς SCADA μένουν εκτός γραφήματος· μέρες με μηδενικά constraints ή σχεδόν μηδενικό surplus εξακολουθούν να απεικονίζονται κανονικά.</li>
        </ul>
            <h3 data-sec="review" class="mt-4 mb-2 text-xs font-bold text-acc-400">Ανασκόπηση ημέρας</h3><ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400"><li><strong class="text-slate-200">Τι δείχνει:</strong> τι άλλαξε στον στόλο αερίου την επιλεγμένη ημέρα σε σχέση με την προηγούμενη ημέρα ή με τον μέσο όρο των προηγούμενων.</li><li><strong class="text-slate-200">Τι κίνησε το κόστος:</strong> η μεταβολή του κόστους του στόλου, χωρισμένη ακριβώς σε όγκο παραγωγής, τιμή αερίου, τιμή CO2 και απόδοση / μείγμα μονάδων. Τα τέσσερα αθροίζουν στο σύνολο, χωρίς υπόλοιπο. Η τιμή CO2 είναι μόνο είσοδος: η σελίδα δείχνει την επίδρασή της σε ευρώ, όχι την τιμή.</li><li><strong class="text-slate-200">Μονάδες:</strong> ταξινομημένες κατά την επίδρασή τους στο κόστος· μονάδα χωρίς παραγωγή εκείνη την ημέρα εμφανίζεται με 0 MWh.</li><li><strong class="text-slate-200">Εκτός και επιστροφές:</strong> μια μονάδα είναι εκτός όταν παράγει έως 1 MWh την ημέρα· επιστρέφει όταν παράγει πάνω από 1 MWh μετά από τουλάχιστον 3 ημέρες εκτός. Το «N+» σημαίνει εκτός από την αρχή του ιστορικού μας (<span data-first-day>1 Ιουν 2026</span>).</li></ul>
        `,
        modalBodyDetailed: `
            <p class="mb-3">Αυτό το Dashboard είναι ένα ανεξάρτητο εργαλείο παρακολούθησης και ανάλυσης μονάδων φυσικού αερίου στην Ελληνική Αγορά Ενέργειας, το οποίο χτίζεται και συντηρείται από έναν μόνο αναλυτή, πάνω σε ανοιχτά δεδομένα. Τα νούμερα είναι εκτιμήσεις και ενδείξεις, όχι επίσημη στατιστική.</p>

            <h3 data-sec="all" class="mt-4 mb-2 text-xs font-bold text-acc-400">Όλα τα tabs</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Εύρος:</strong> αφορά αποκλειστικά μονάδες φυσικού αερίου (CCGT) συνδεδεμένες στο Σύστημα Μεταφοράς (ΑΔΜΗΕ) που εμφανίζονται στα δημοσιευμένα αρχεία του. Λιγνιτικές μονάδες (π.χ. Πτολεμαΐδα5) και μεγάλα υδροηλεκτρικά (π.χ. Άγρας) εξαιρούνται ακόμα κι όταν εμφανίζονται στα ίδια αρχεία-πηγές με τις μονάδες αερίου. Μονάδες συμπαραγωγής με κλειδωμένη παραγωγή 24/7 (π.χ. Αλουμίνιο) εξαιρούνται επίσης από την παρακολούθηση constraints, αφού η παραγωγή τους δεν ανταποκρίνεται στην αγορά.</li>
                <li><strong class="text-slate-200">Πηγές δεδομένων:</strong> Αντλούνται καθημερινά από τον ΑΔΜΗΕ (ISP & SCADA) και το HEnEx (Δείκτες NGAS)· η τιμή CO2 προέρχεται από το OilPriceAPI (τιμή CO2 της ΕΕ, €/t), με ένα αίτημα την ημέρα, και χρησιμοποιείται μόνο ως είσοδος του κόστους CO2: η σελίδα δεν την εμφανίζει ούτε την αναδημοσιεύει. Το ISP είναι ο προγραμματισμός του ΑΔΜΗΕ για το 24ωρο: το ISP1 είναι ο πρώτος (γύρω στις 18:00 της προηγούμενης ημέρας) και το ISP2 ο δεύτερος (γύρω στα μεσάνυχτα της ίδιας ημέρας)· η σελίδα χρησιμοποιεί το ISP2.</li>
                <li><strong class="text-slate-200">Ενημερώσεις:</strong> δύο φορές την ημέρα, στις 07:06 και στις 13:00 (ώρα Ελλάδος), μέσω προγραμματισμένης εργασίας. Οι τελευταίες 10 μέρες επανελέγχονται σε κάθε run για καθυστερημένες δημοσιεύσεις και διορθώσεις.</li>
                <li><strong class="text-slate-200">Πληρότητα δεδομένων:</strong> Τα δεδομένα SCADA για μια ημέρα δημοσιεύονται από τον ΑΔΜΗΕ το επόμενο πρωί· μέχρι τότε η ημέρα εμφανίζεται ως "Pending SCADA" με βάση μόνο τα δεδομένα ISP. Αντίστοιχα, το HEnEx δημοσιεύει το HGSIDA μιας ημέρας την επόμενη, γύρω στο μεσημέρι· μέχρι τότε τα economics της ημέρας αναβάλλονται εξολοκλήρου για το επόμενο run, αντί να υπολογιστούν με ελλιπή ή μηδενική τιμή. Το pill δίπλα στην ημερομηνία λέει σε ποια περίπτωση είναι η ημέρα: «Πλήρη δεδομένα»· «Εκκρεμεί SCADA» (δείχνεται μόνο με ISP)· «Αναμονή HGSIDA» (μία από τις τελευταίες 3 ημέρες: το SCADA υπάρχει και τα οικονομικά περιμένουν την τιμή)· «Χωρίς οικονομικά» (παλαιότερη ημέρα για την οποία δεν υπάρχουν οικονομικά). Στα tabs Ημερήσια οικονομικά και Ανασκόπηση ημέρας, μια τέτοια ημέρα δείχνει ποια δεδομένα λείπουν και ένα κουμπί προς την τελευταία ημέρα με δεδομένα.</li>
                <li><strong class="text-slate-200">Ιστορικό και ώρα:</strong> τα δεδομένα ξεκινούν από <span data-first-day>1 Απρ 2026</span>. Οι ώρες είναι ώρα Ελλάδος· τις ημέρες αλλαγής ώρας (23 ή 25 ώρες) διαβάζονται όλες οι ώρες της ημέρας.</li>
                    <li><strong class="text-slate-200">Αποποίηση ευθύνης:</strong> Το παρόν dashboard έχει ενημερωτικό χαρακτήρα και δεν αποτελεί επενδυτική συμβουλή.</li>
    </ul>

            <h3 data-sec="overview" class="mt-4 mb-2 text-xs font-bold text-acc-400">Ημερήσια επισκόπηση</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> το ISP δείχνει τι προγραμματίστηκε, το SCADA τι πραγματικά συνέβη. Διαφορές ανάμεσά τους είναι αναμενόμενες και συχνά σημαντικές — μεγάλα χάσματα μπορεί να υποδεικνύουν re-dispatch της τελευταίας στιγμής ή δραστηριότητα constraints.</li>
                <li><strong class="text-slate-200">Σύνολα και γράφημα:</strong> τα δύο σύνολα αθροίζουν τις μονάδες αερίου της επιλεγμένης ημέρας (με το Αλουμίνιο). Κάθε μονάδα έχει δύο μπάρες: συμπαγής = ISP, διαγραμμισμένη = SCADA. Μέρα χωρίς SCADA δείχνει μόνο ISP.</li>
                <li><strong class="text-slate-200">Κλάσεις:</strong> οι μονάδες ομαδοποιούνται με βάση μια υποθετική απόδοση σε H-Class (Super-Efficient, 2 μονάδες), F-Class (Standard, 8) και Παλαιότερες και μονάδες αιχμής (3), και το γράφημα τις ταξινομεί κατά κλάση. Η ομαδοποίηση είναι του αναλυτή, συγκεντρωμένη από επιμέρους δημόσιες πηγές του διαδικτύου, και δίνεται με επιφύλαξη· δεν είναι επίσημος χαρακτηρισμός.</li>
            </ul>

            <h3 data-sec="economics" class="mt-4 mb-2 text-xs font-bold text-acc-400">Ημερήσια οικονομικά</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Κόστος παραγωγής:</strong> Υπολογίζεται θεωρητικά βάσει του δείκτη HEnEx (HGSIDA), διαιρούμενου με τον Βαθμό Απόδοσης της εκάστοτε κλάσης, προσθέτοντας το κόστος ρύπων CO2. Η HGSIDA χρησιμοποιείται ενιαία για όλες τις μονάδες και ώρες ως παραδοχή απλοποίησης — το HEnEx δημοσιεύει πολλαπλούς διακριτούς δείκτες τιμής αερίου (HGSIDA, HGMBI, HGMSI, HGSIWD), και δεν υπάρχουν δημόσια στοιχεία που να δείχνουν ποιος δείκτης, αν κάποιος, ίσχυσε πραγματικά για την προμήθεια αερίου συγκεκριμένης μονάδας σε συγκεκριμένη ώρα. Το HGSIDA μιας ημερομηνίας είναι η τιμή day-ahead που διαπραγματεύτηκε εκείνη την ημέρα για παράδοση την επόμενη ημέρα αερίου (ο δείκτης του αρχείου της ημέρας διαπραγμάτευσης)· το dashboard τη χρησιμοποιεί ως τιμή αερίου της ίδιας ημερομηνίας, γνωστή απλοποίηση: με την τιμή που διαπραγματεύτηκε την προηγούμενη ημέρα το συνολικό κόστος καυσίμου θα ήταν περίπου 0,5% χαμηλότερο και κάθε μεταβολή τιμής θα μετατοπιζόταν κατά μία ημέρα.</li>
                <li><strong class="text-slate-200">Δυναμικό μοντέλο κόστους καυσίμου:</strong> Το κόστος καυσίμου δεν είναι ένα ενιαίο ημερήσιο νούμερο ανά μονάδα — υπολογίζεται ξεχωριστά για κάθε ώρα, βάσει της πραγματικής παραγωγής SCADA εκείνης της ώρας. Κάθε μονάδα έχει ένα παραδοχικό τεχνικό ελάχιστο και ονομαστικό μέγιστο (MW), και μια παραδοχική απόδοση και ένταση CO2 σε αυτά τα δύο άκρα. Για μια δεδομένη ώρα, το μοντέλο εντοπίζει την πραγματική παραγωγή γραμμικά ανάμεσα στο ελάχιστο και το μέγιστο, και με την ίδια αυτή θέση παρεμβάλλει γραμμικά τόσο την απόδοση όσο και τον συντελεστή εκπομπών CO2 της ώρας — μονάδα που λειτουργεί κοντά στο τεχνικό της ελάχιστο θεωρείται λιγότερο αποδοτική (και πιο ρυπογόνα ανά MWh) από την ίδια μονάδα σε πλήρες φορτίο. Το ωριαίο κόστος καυσίμου προκύπτει διαιρώντας την HGSIDA με την παρεμβαλλόμενη απόδοση της ώρας, επί τα MWh της ώρας· το κόστος CO2 ακολουθεί την ίδια ωριαία λογική. Η βασική παραδοχή απλοποίησης είναι η γραμμικότητα: οι πραγματικές καμπύλες heat-rate των CCGT δεν είναι συνήθως γραμμικές — το μοντέλο αντιμετωπίζει τη σχέση ως ευθεία γραμμή ανάμεσα στα δύο γνωστά άκρα, ελλείψει δημόσια διαθέσιμων, ανά-μονάδα καμπυλών heat-rate. Για μονάδα χωρίς δημοσιευμένα τεχνικά χαρακτηριστικά, χρησιμοποιείται γενικό προφίλ αντί για εξειδικευμένες τιμές.</li>
                <li><strong class="text-slate-200">Τιμή CO2 & εκτιμήσεις:</strong> η τιμή CO2 της ΕΕ (EUA, από το OilPriceAPI) χρησιμοποιείται μόνο ως είσοδος του κόστους CO2 κάθε μονάδας (τόνοι × τιμή)· η σελίδα ούτε την εμφανίζει ούτε την αναδημοσιεύει, και δείχνει μόνο τα κόστη που προκύπτουν και τις εκπομπές σε τόνους. Η τιμή είναι ενδεικτική τιμή spot του EU ETS, όπως τη συλλέγει το OilPriceAPI (συγκεντρωτική από market makers, όχι το επίσημο κλείσιμο του ICE)· αποθηκεύεται στρογγυλοποιημένη στα 0,5 €/t και χρησιμοποιείται ως εκτίμηση. Όταν δεν υπάρχει διαθέσιμη πραγματική τιμή για μια ημερομηνία, ο υπολογισμός συνειδητά καταφεύγει στην τελευταία γνωστή πραγματική τιμή τα Σαββατοκύριακα (η αγορά είναι κλειστή, οπότε η προηγούμενη πραγματική τιμή μεταφέρεται) ή, αν δεν υπάρχει καμία τιμή, σε μια σταθερή τιμή αναφοράς (€85.00/τόνο) — αντί να αφήσει τον υπολογισμό ελλιπή. Οι ημέρες αυτές σημειώνονται ως εκτιμήσεις στα δεδομένα, και η εκτίμηση επηρεάζει μόνο το κόστος CO2 εκείνης της ημέρας.</li>
                <li><strong class="text-slate-200">SRMC:</strong> βραχυχρόνιο οριακό κόστος: το κόστος καυσίμου και CO2 για την παραγωγή 1 MWh. Το μέσο SRMC στόλου είναι το συνολικό κόστος της ημέρας διά τις MWh της, δηλαδή σταθμισμένο με την παραγωγή.</li>
                <li><strong class="text-slate-200">Απόδοση:</strong> δεν είναι ονομαστική τιμή αλλά η ενεργός απόδοση της ημέρας = MWh × HGSIDA ÷ κόστος καυσίμου. Προκύπτει από το ωριαίο μοντέλο παραπάνω, γι' αυτό εξαρτάται από το πόσο φορτισμένες δούλεψαν οι μονάδες.</li>
                <li><strong class="text-slate-200">Τα νούμερα της σελίδας:</strong> τιμή HGSIDA (€/MWh)· εκπομπές CO2 του στόλου (t, από τους μοντελοποιημένους συντελεστές εκπομπών)· απόδοση στόλου (%) όπως παραπάνω· μέσο SRMC στόλου (€/MWh)· παραγωγή αερίου (MWh) είναι το σύνολο SCADA της ημέρας· εκτιμώμενο συνολικό κόστος (€) είναι καύσιμο συν CO2 για όλες τις μονάδες.</li>
                <li><strong class="text-slate-200">Πίνακας:</strong> ανά μονάδα: παραγωγή (MWh από SCADA), ενεργός απόδοση, εκπομπές CO2 (t), SRMC (€/MWh) και κόστος (€, για όλη την ημέρα, όχι ανά MWh).</li>
            </ul>

            <h3 data-sec="monthly" class="mt-4 mb-2 text-xs font-bold text-acc-400">Μηνιαία ανάλυση</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Τι δείχνει:</strong> ένα σημείο ανά ημέρα του επιλεγμένου μήνα, όχι μηνιαίους μέσους όρους. Εμφανίζονται μόνο ημέρες με ολοκληρωμένα οικονομικά (SCADA και HGSIDA)· ο τρέχων μήνας γεμίζει μέρα με τη μέρα.</li>
            <li><strong class="text-slate-200">Boxes πάνω από το γράφημα:</strong> ο μήνας έναντι του προηγούμενου χρησιμοποιεί μέσους όρους <em>ανά ημέρα</em> των ημερών που έχουν οικονομικά (η απόδοση στόλου είναι τα συνολικά MWh προς τη συνολική ενέργεια αερίου· το HGSIDA είναι ο απλός μέσος των ημερών αυτών· το CO2 εμφανίζεται ως εκπομπές, ποτέ ως τιμή). Το «τι κίνησε το κόστος» χρησιμοποιεί την ίδια μέθοδο λογαριθμικού μέσου με την Ανασκόπηση ημέρας, στους μέσους ανά ημέρα των δύο μηνών. Στον χάρτη διαθεσιμότητας κάθε κελί είναι η ημερήσια παραγωγή μιας μονάδας: σκούρο = εκτός (έως 1 MWh), φωτεινότερο = υψηλότερη παραγωγή σε σχέση με το μέγιστο της ίδιας μονάδας τον μήνα· το πλαίσιο δείχνει επιστροφή μετά από τουλάχιστον 3 ημέρες εκτός· το «N+» σημαίνει εκτός από την αρχή του ιστορικού μας.</li>
                <li><strong class="text-slate-200">Οι τρεις γραμμές:</strong> τιμή HGSIDA και μέσο SRMC στόλου (€/MWh, αριστερός άξονας) και απόδοση στόλου (%, δεξιός άξονας), όπως ορίζονται στα Ημερήσια οικονομικά.</li>
                <li><strong class="text-slate-200">Η γραμμή κάτω από τον τίτλο του γραφήματος:</strong> οι ακραίες ημέρες του μήνα, με την ημερομηνία τους: υψηλότερο και χαμηλότερο μέσο SRMC στόλου, χαμηλότερη και υψηλότερη απόδοση. Αλλάζουν όσο προστίθενται ημέρες στον τρέχοντα μήνα.</li>
                <li><strong class="text-slate-200">Πώς διαβάζεται:</strong> το SRMC εξαρτάται από την τιμή του αερίου, από την απόδοση με την οποία δούλεψαν οι μονάδες και από την τιμή CO2.</li>
                <li><strong class="text-slate-200">Ημέρες χωρίς τιμή:</strong> ημέρα με μηδενικό SRMC ή απόδοση (χωρίς έγκυρο υπολογισμό) δεν μετρά στις χαμηλότερες τιμές των καρτών.</li>
        </ul>

            <h3 data-sec="surplus" class="mt-4 mb-2 text-xs font-bold text-acc-400">Περιορισμοί συστήματος &amp; πλεόνασμα</h3>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Λειτουργία Out-of-Merit:</strong> Λόγω υψηλής διείσδυσης ΑΠΕ, ο ΑΔΜΗΕ διατηρεί συχνά μονάδες συγχρονισμένες μέσω Generic Constraints για ευστάθεια συστήματος. Το dashboard παίρνει τις μονάδες αερίου και τις ώρες αυτών των constraints από τον προγραμματισμό ISP2 (το φύλλο GenericConstraints) και μετρά την πραγματική παραγωγή SCADA της μονάδας μέσα σε αυτές τις ώρες ως constraint-driven παραγωγή (τα παράθυρα μετρούν σε ολόκληρες ώρες: αρχή ή τέλος σε μισή ώρα στρογγυλοποιείται προς τα κάτω στην ώρα) — όχι ως market-driven arbitrage. Δεν συγκρίνονται τιμές: μια μονάδα μπορεί να λειτουργεί κάτω από το κόστος της και για άλλους λόγους (τεχνικό ελάχιστο, block orders, εξισορρόπηση), και αυτή η προβολή δεν μετρά εκείνες τις ώρες. Στην πράξη, αυτός είναι ο μόνος διαθέσιμος τρόπος προσέγγισης του residual surplus που απομένει από τον προγραμματισμό (ISP), αν και πρόκειται για ατελές proxy, καθώς ο προγραμματισμός δεν είναι μέτρηση και το πραγματικό μέγεθος αυτού του πλεονάσματος δεν μπορεί να επιβεβαιωθεί ανεξάρτητα από δημόσια δεδομένα.</li>
                <li><strong class="text-slate-200">Ποιες μονάδες μετράνε:</strong> παρακολουθούνται μόνο μονάδες φυσικού αερίου· λιγνιτικές και μεγάλα υδροηλεκτρικά που εμφανίζονται στο ίδιο αρχείο ISP φιλτράρονται έξω, όπως και η μονάδα συμπαραγωγής με κλειδωμένη 24/7 παραγωγή.</li>
            <li><strong class="text-slate-200">Επίδραση ανά μονάδα:</strong> χρησιμοποιούνται μόνο ώρες με παραγωγή. «Μέσα» είναι οι ώρες του περιορισμού και «έξω» οι υπόλοιπες ώρες των ίδιων ημερών. Το επιπλέον αέριο είναι το αέριο που χρησιμοποιήθηκε μέσα στον περιορισμό μείον όσο θα χρειαζόταν η ίδια ενέργεια (MWh) στην απόδοση που έχει η μονάδα έξω από αυτόν· η αξία του χρησιμοποιεί το HGSIDA κάθε ημέρας και δεν περιλαμβάνει το CO2. Η απόδοση είναι μοντελοποιημένη (όπως στα Ημερήσια οικονομικά), άρα το μέγεθος της επίδρασης εξαρτάται από την παραδοχή μερικού φορτίου (k = 0,30, βλ. Περιορισμοί)· αρνητική μεταβολή σε μονάδες σημαίνει ότι ο περιορισμός μείωσε την απόδοση.</li>
                <li><strong class="text-slate-200">Pending μέρες vs μηδενικές μέρες:</strong> μια μέρα εξαιρείται από το γράφημα μόνο όταν δεν υπάρχει ακόμα SCADA γι' αυτήν. Μέρα με SCADA αλλά μηδενικά καταγεγραμμένα constraints, ή με πολύ χαμηλό residual surplus, παραμένει στο γράφημα και δείχνεται ως μηδέν — δεν αντιμετωπίζεται όπως μια pending μέρα.</li>
                <li><strong class="text-slate-200">Residual surplus (ISP):</strong> η ημερήσια τιμή της γραμμής «Energy Surplus» του αρχείου ISP2 του ΑΔΜΗΕ, σε MWh. Δεν την υπολογίζει η σελίδα· ο ΑΔΜΗΕ τη γράφει αρνητική και η σελίδα τη δείχνει θετική.</li>
                <li><strong class="text-slate-200">Μηνιαία σύνολα:</strong> το άθροισμα των ημερών που φαίνονται στο γράφημα (ημέρες με SCADA).</li>
                <li><strong class="text-slate-200">Δύο διαφορετικά μεγέθη:</strong> το πλεόνασμα είναι μέγεθος του προγράμματος, ενώ η constraint-driven παραγωγή είναι πραγματική παραγωγή. Συγκρίνονται ως ενδείξεις, όχι ως ισοζύγιο.</li>
        </ul>
            <h3 data-sec="review" class="mt-4 mb-2 text-xs font-bold text-acc-400">Ανασκόπηση ημέρας</h3><ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400"><li><strong class="text-slate-200">Τι δείχνει:</strong> τι άλλαξε στον στόλο αερίου την επιλεγμένη ημέρα. Ακολουθεί την επιλογή ημερομηνίας και υπολογίζεται από τα οικονομικά της ημέρας και από δικά μας παράγωγα στοιχεία (<code>data/review.json</code>), που η σελίδα φορτώνει στην εκκίνηση, μαζί με τα άλλα αρχεία δεδομένων.</li><li><strong class="text-slate-200">Σύγκριση:</strong> η «προηγούμενη ημέρα» είναι η ημέρα του ημερολογίου πριν και χρειάζεται τα οικονομικά της· ο «μέσος όρος 7 ημερών» είναι ο μέσος, ημέρα με ημέρα, έως 7 προηγούμενων ημερών που έχουν οικονομικά (τουλάχιστον 3).</li><li><strong class="text-slate-200">Τι κίνησε το κόστος:</strong> η μεταβολή του κόστους του στόλου χωρίζεται με τη μέθοδο του λογαριθμικού μέσου (LMDI), που είναι ακριβής και δεν εξαρτάται από τη σειρά των παραγόντων. Ο όγκος είναι η επίδραση της μεταβολής των συνολικών MWh· η τιμή αερίου και η τιμή CO2 είναι οι επιδράσεις της μεταβολής της τιμής ανά μονάδα αερίου και ανά τόνο· η απόδοση / μείγμα είναι η επίδραση της μεταβολής του αερίου και του CO2 ανά παραγόμενη MWh, δηλαδή ποιες μονάδες δούλεψαν και πόσο φορτισμένες. Τα τέσσερα αθροίζουν στο σύνολο χωρίς υπόλοιπο (σε ακέραια ευρώ). Η τιμή CO2 είναι είσοδος του υπολογισμού και δεν εμφανίζεται· εμφανίζεται μόνο η επίδρασή της σε ευρώ.</li><li><strong class="text-slate-200">Μονάδες:</strong> κάθε μονάδα που δούλεψε εκείνη την ημέρα ή στη σύγκριση, ταξινομημένη κατά τη μεταβολή του κόστους της (οι μεταβολές αθροίζουν στη μεταβολή του κόστους του στόλου). Η απόδοση είναι μοντελοποιημένη, όπως στα Ημερήσια οικονομικά, και συγκρίνεται με τη διάμεσο των προηγούμενων 30 ημερών της μονάδας με παραγωγή (τουλάχιστον 5).</li><li><strong class="text-slate-200">Εκτός και επιστροφές:</strong> μια μονάδα είναι εκτός όταν παράγει έως 1 MWh την ημέρα και επιστρέφει όταν παράγει πάνω από 1 MWh μετά από τουλάχιστον 3 ημέρες εκτός· το «N+» σημαίνει ότι η σειρά αρχίζει από την αρχή του ιστορικού μας (<span data-first-day>1 Ιουν 2026</span>), άρα το πραγματικό διάστημα είναι μεγαλύτερο. Κενό στις ημερομηνίες σπάει τη σειρά.</li><li><strong class="text-slate-200">Generic constraints:</strong> η μονάδα, το παράθυρο του περιορισμού της στο αρχείο ISP2 του ΑΔΜΗΕ (ώρες ρολογιού) και τα MWh που παρήγαγε σε αυτές τις ώρες (ωριαίο SCADA).</li><li><strong class="text-slate-200">Όρια:</strong> το κόστος είναι θεωρητικό, όπως στα Ημερήσια οικονομικά· οι επιδράσεις είναι ενδείξεις, όχι λογιστική.</li></ul>

            <h3 data-sec="limits" class="mt-4 mb-2 text-xs font-bold text-acc-400">Περιορισμοί</h3>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Δεδομένα:</strong> Τα δεδομένα SCADA δημοσιεύονται από τον ΑΔΜΗΕ ως προκαταρκτικά/μη πιστοποιημένα και μπορεί να αναθεωρηθούν. Το ISP είναι πρόγραμμα, όχι μέτρηση πραγματικής παράδοσης.</li>
                <li><strong class="text-slate-200">Μοντέλο κόστους:</strong> βασίζεται σε έναν ενιαίο, απλοποιημένο δείκτη τιμής αερίου (HGSIDA) αντί για δεδομένα προμήθειας ανά μονάδα, και δεν αντανακλά το πραγματικό πραγματοποιηθέν έσοδο ή τον διακανονισμό αγοράς κάθε μονάδας.</li>
                <li><strong class="text-slate-200">Φύση:</strong> πρόκειται για ανεξάρτητη ανάλυση ανοιχτών δεδομένων. Δεν αποτελεί επίσημη θέση του ΑΔΜΗΕ, του HEnEx, ή οποιουδήποτε άλλου οργανισμού.</li>
                <li><strong class="text-slate-200">Υποθέσεις:</strong> το ελάχιστο και το μέγιστο φορτίο, η απόδοση και οι εκπομπές CO2 κάθε μονάδας, καθώς και η κλάση της, είναι υποθέσεις που συγκεντρώθηκαν από δημόσιες πηγές στο διαδίκτυο (π.χ. ENTSO-E, ΑΔΜΗΕ), όχι μετρήσεις. Είναι ευθύνη του αναλυτή και δίνονται με επιφύλαξη.</li>
                <li><strong class="text-slate-200">Απόδοση σε μερικό φορτίο:</strong> η απόδοση πέφτει γραμμικά από το πλήρες φορτίο προς το ελάχιστο. Τα CCGT τύπου F χάνουν το ίδιο ποσοστό της απόδοσής τους ανά μονάδα φορτίου κάτω από το πλήρες όσο και οι H-class (περίπου 30%: στο μισό φορτίο μια μονάδα δίνει περίπου το 85% της απόδοσής της σε πλήρες φορτίο)· οι παλιότερες μονάδες κρατούν τις δικές τους τιμές. Τα ελάχιστα φορτία των Thisvi, Θεσσαλονίκης, Ήρωνα και Μεγαλόπολης 5 ορίστηκαν εκεί όπου συσσωρεύεται το ωριαίο SCADA κάθε μονάδας. Οι πραγματικές καμπύλες των μονάδων δεν είναι γνωστές, και οι μονάδες που δουλεύουν κυρίως κοντά στο ελάχιστο (Thisvi, Ήρων, Θεσσαλονίκη) είναι οι πιο ευαίσθητες σε αυτή την παραδοχή.</li>
                <li><strong class="text-slate-200">Τι δεν περιλαμβάνει το κόστος:</strong> μετρούνται μόνο καύσιμο και CO2· άλλα κόστη (π.χ. λειτουργίας και συντήρησης, εκκινήσεις, μεταφορά αερίου) δεν περιλαμβάνονται.</li>
            </ul>
        `
    }
};

let methodologyDepth = 'short'; // 'short' | 'detailed'

function renderMethodologyModal() {
    const t = i18n[currentLang];
    if (document.getElementById('modalTitle')) document.getElementById('modalTitle').innerText = t.modalTitle;
    if (document.getElementById('modalBody')) {
        document.getElementById('modalBody').innerHTML = methodologyDepth === 'detailed' ? t.modalBodyDetailed : t.modalBodyShort;
        // Η πρώτη ημέρα του ιστορικού μας από τα δεδομένα (review.json), όχι γραμμένη στο κείμενο (D41)
        if (typeof reviewData !== 'undefined' && reviewData && reviewData.first_day) { const f = fmtDay(reviewData.first_day); document.querySelectorAll('#modalBody [data-first-day]').forEach(e => { e.textContent = f; }); }
    }
    const x = document.getElementById('modalXBtn'); if (x) x.setAttribute('aria-label', t.btnClose);
    const btnShort = document.getElementById('btnMethodologyShort');
    const btnDetailed = document.getElementById('btnMethodologyDetailed');
    if (btnShort && btnDetailed) {
        btnShort.innerText = t.btnShort;
        btnDetailed.innerText = t.btnDetailed;
        const on = 'flex-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-acc-400 text-slate-900 transition';
        const off = 'flex-1 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-400 hover:text-slate-200 transition';
        btnShort.className = methodologyDepth === 'short' ? on : off;
        btnDetailed.className = methodologyDepth === 'detailed' ? on : off;
        btnShort.setAttribute('aria-pressed', methodologyDepth === 'short');
        btnDetailed.setAttribute('aria-pressed', methodologyDepth === 'detailed');
    }
}

// ==========================================================================================
// ΤΟ ΠΑΡΑΘΥΡΟ «ΜΕΘΟΔΟΛΟΓΙΑ» (D23, όπως BESS D28–D30)
// ==========================================================================================
// Ανοίγει στην ενότητα του tab που βλέπεις· κλείνει με το X, με το κουμπί, με Esc και με κλικ έξω· το focus μένει μέσα
// στο παράθυρο και γυρνά στο κουμπί που το άνοιξε· η σελίδα από πίσω δεν κυλάει.
// Οι σύνδεσμοι «Μεθοδολογία →» μέσα στα tabs ανοίγουν την Αναλυτική στην ίδια ενότητα (openMethodologyModal(tab, 'detailed')).
const METHOD_SEC = { overview: 'overview', economics: 'economics', ispScada: 'monthly', surplus: 'surplus', review: 'review' };
let methodologyOpener = null, methodOpenSec = null, methodOpenScroll = 0;

// Θέση μιας ενότητας μέσα στο scroll του παραθύρου (offsetTop: δεν επηρεάζεται από το scale-95 την ώρα του fade-in)
const methodSecTop = (el) => el.offsetTop;
function currentMethodSec() {
    const body = document.getElementById('modalBody');
    if (!body) return null;
    let cur = null;
    body.querySelectorAll('[data-sec]').forEach(el => { if (methodSecTop(el) - 12 <= body.scrollTop) cur = el.dataset.sec; });
    return cur;
}
function scrollMethodologyTo(sec) {
    const body = document.getElementById('modalBody');
    const el = body && body.querySelector('[data-sec="' + sec + '"]');
    if (el) body.scrollTop = Math.max(0, methodSecTop(el) - 8);
}

// Σύντομη ↔ Αναλυτική: μένεις στην ίδια ενότητα
function setMethodologyDepth(depth, fromOpen) {
    const body0 = document.getElementById('modalBody');
    const untouched = body0 && methodOpenSec && Math.abs(body0.scrollTop - methodOpenScroll) < 2;
    const keep = fromOpen ? null : (untouched ? methodOpenSec : currentMethodSec());
    methodologyDepth = depth === 'detailed' ? 'detailed' : 'short';
    renderMethodologyModal();
    const body = document.getElementById('modalBody');
    if (!body) return;
    body.scrollTop = 0;
    if (keep && keep !== 'all') scrollMethodologyTo(keep);
}

function openMethodologyModal(tab, view) {
    const modal = document.getElementById('methodologyModal');
    if (!modal || !modal.classList.contains('hidden')) return;
    const sec = (tab && METHOD_SEC[tab]) || null;
    methodologyOpener = document.activeElement;
    setMethodologyDepth(view || 'short', true);
    document.body.style.overflow = 'hidden';            // κλειδώνει το scroll της σελίδας πίσω από το παράθυρο
    modal.classList.remove('hidden');
    document.getElementById('modalBody').scrollTop = 0; // μετά το άνοιγμα: σε κρυφό στοιχείο (display:none) η θέση δεν αλλάζει και θα έμενε η προηγούμενη
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modalContent').classList.remove('scale-95');
    }, 10);
    document.getElementById('modalXBtn').focus();
    methodOpenSec = null;
    if (sec) { scrollMethodologyTo(sec); methodOpenSec = sec; methodOpenScroll = document.getElementById('modalBody').scrollTop; }
}

function closeMethodologyModal() {
    const modal = document.getElementById('methodologyModal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('opacity-0');
    document.getElementById('modalContent').classList.add('scale-95');
    document.body.style.overflow = '';
    setTimeout(() => {
        modal.classList.add('hidden');
        if (methodologyOpener && methodologyOpener.focus) methodologyOpener.focus();
        methodologyOpener = null;
    }, 300);
}

document.addEventListener('keydown', (e) => {
    const m = document.getElementById('methodologyModal');
    if (!m || m.classList.contains('hidden')) return;
    if (e.key === 'Escape') { closeMethodologyModal(); return; }
    if (e.key === 'Tab') {                              // το focus κυκλώνει ανάμεσα στα κουμπιά του παραθύρου
        const f = ['modalXBtn', 'btnMethodologyShort', 'btnMethodologyDetailed', 'btnClose'].map(id => document.getElementById(id)).filter(Boolean);
        const i = f.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
        e.preventDefault(); f[next].focus();
    }
});

function setLang(lang) {
    if (lang !== 'el' && lang !== 'en') return;
    currentLang = lang;
    try { localStorage.setItem('kp_lang', lang); } catch (e) { /* ιδιωτική περιήγηση */ }
    const t = i18n[lang];

    // Οθόνη φόρτωσης: τα βήματα 2…6 παίρνουν τα ονόματα των tabs, με τη σειρά τους
    const L = t.load;
    const stepText = { 1: L.s1, 2: t.tabOverview, 3: t.tabEconomics, 4: t.tabIspScada, 5: t.tabSurplus, 6: t.tabReview };
    const loadIds = { loadTitle: L.title, loadGroup1: L.g1, loadGroup2: L.g2, loadReady: L.ready };
    Object.entries(loadIds).forEach(([id, txt]) => { const el = document.getElementById(id); if (el) el.textContent = txt; });
    document.querySelectorAll('.load-row').forEach(r => { const lb = r.querySelector('[data-load-label]'); if (lb) lb.textContent = stepText[r.dataset.step] || ''; });
    
    document.getElementById('pageTitle').innerText = t.title;
    document.getElementById('mainTitle').innerText = t.title;
    document.getElementById('lastUpdateLabel').innerText = t.lastUpdateMobile || t.lastUpdate;
    document.getElementById('nextUpdateLabel').innerText = t.nextUpdateMobile || t.nextUpdate;
    document.getElementById('lastUpdateLabelDesktop').innerText = t.lastUpdate;
    document.getElementById('nextUpdateLabelDesktop').innerText = t.nextUpdate;
    
    if(document.getElementById('btnMethodologyText')) document.getElementById('btnMethodologyText').innerText = t.btnMethodology;
    const bms = document.getElementById('btnMethodologyTextShort'); if (bms) bms.innerText = t.btnMethodologyShort;
    document.querySelectorAll('.meth-link').forEach(el => { el.textContent = t.methodLink; });
    // Όλα τα κείμενα των tabs (ετικέτες, τίτλοι, υπότιτλοι, υπομνήματα, κεφαλίδες πίνακα) από το i18n (D25)
    document.querySelectorAll('[data-i18n]').forEach(el => { const v = t[el.dataset.i18n]; if (v !== undefined) el.textContent = v; });
    const toTopBtn = document.getElementById('toTopBtn'); if (toTopBtn) { toTopBtn.setAttribute('aria-label', t.toTop); toTopBtn.title = t.toTop; }
    renderMethodologyModal();
    if(document.getElementById('btnClose')) document.getElementById('btnClose').innerText = t.btnClose;

    document.getElementById('tabBtnOverview').innerText = t.tabOverview;
    document.getElementById('tabBtnEconomics').innerText = t.tabEconomics;
    document.getElementById('tabBtnIspScada').innerText = t.tabIspScada;
    document.getElementById('tabBtnSurplus').innerText = t.tabSurplus;
    document.getElementById('tabBtnReview').innerText = t.tabReview;
    
    // GR | EN: το ενεργό παίρνει το accent με σκούρα γράμματα (hub)
    const LANG_ON = 'flex items-center justify-center px-4 rounded bg-acc-400 text-slate-900 transition';
    const LANG_OFF = 'flex items-center justify-center px-4 rounded text-slate-400 hover:text-white transition';
    document.getElementById('btnGr').className = lang === 'el' ? LANG_ON : LANG_OFF;
    document.getElementById('btnEn').className = lang === 'en' ? LANG_ON : LANG_OFF;

    fitMetaRow();
    if (appReady && typeof updateDashboard === "function") updateDashboard();
}

// Τελευταία / Επόμενη ενημέρωση: τις γράφει το Python στο data/meta.json (hub D06: `fetched` και `next_update`,
// UTC). Η σελίδα μόνο τις δείχνει, σε ώρα Ελλάδος (σωστά και στην αλλαγή ώρας). Αν λείπει το αρχείο: «-».
const ATHENS_FMT = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
function fmtAthens(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '-';
    const p = Object.fromEntries(ATHENS_FMT.formatToParts(d).map(x => [x.type, x.value]));
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
// Σύντομη μορφή για το κινητό (D22): «26/10 07:07», χωρίς έτος, ώστε Ενημερώθηκε και Επόμενη να χωράνε σε μία γραμμή
function fmtAthensShort(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '-';
    const p = Object.fromEntries(ATHENS_FMT.formatToParts(d).map(x => [x.type, x.value]));
    return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}
// Εφαρμογή του meta.json στην κεφαλίδα (Τελευταία / Επόμενη ενημέρωση). Αν λείπει: «-».
// Στο κινητό οι δύο ώρες μπαίνουν σε μία γραμμή· αν δεν χωράνε (π.χ. ελληνικά στα 320 px) πηγαίνουν η μία κάτω από την άλλη
function fitMetaRow() {
    const row = document.getElementById('metaRow'), sep = document.getElementById('metaSep');
    if (!row) return;
    row.classList.remove('flex-col', 'items-start', 'gap-y-0.5'); row.classList.add('items-center'); if (sep) sep.classList.remove('hidden');
    if (row.scrollWidth > row.clientWidth + 1) {
        row.classList.remove('items-center'); row.classList.add('flex-col', 'items-start', 'gap-y-0.5'); if (sep) sep.classList.add('hidden');
    }
}
window.addEventListener('resize', fitMetaRow);

function applyMeta(meta) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    set('lastUpdateVal', meta ? fmtAthens(meta.fetched) : '-');
    set('lastUpdateValShort', meta ? fmtAthensShort(meta.fetched) : '-');
    set('nextUpdateVal', meta ? fmtAthens(meta.next_update) : '-');
    set('nextUpdateValShort', meta ? fmtAthensShort(meta.next_update) : '-');
    fitMetaRow();
}

// Τα δεδομένα του historical.json στη μνήμη + η λίστα ημερομηνιών
function applyData(json) {
    rawData.isp = json.isp_generation || [];
    rawData.scada = json.scada_generation || [];
    rawData.constrained = Array.isArray(json.daily_constrained_mwh) ? json.daily_constrained_mwh : null;
    rawData.henex = json.henex_indices || [];
    rawData.efficiency = json.thermal_efficiency || [];
    rawData.daily_surplus = json.daily_surplus || [];
    rawData.daily_economics = json.daily_economics || [];
    rawData.dayStatus = (Array.isArray(json.day_status) && json.day_status.length) ? Object.fromEntries(json.day_status.map(r => [r['Ημερομηνία'], r])) : null;
}

// ==========================================================================================
// ΟΘΟΝΗ ΦΟΡΤΩΣΗΣ & ΕΚΚΙΝΗΣΗ (D20, όπως live-greekpower D47 / Flows D03 / BESS D03)
// ==========================================================================================
// Πρώτα η δουλειά, μετά το γέμισμα της μπάρας, μετά το ✓. Χρόνοι ίδιοι με το live.
// Τα βήματα σε εξέλιξη είναι στο accent (μπλε)· ό,τι έχει τελειώσει (μπάρα, ✓, «έτοιμο») είναι πράσινο,
// γιατί το πράσινο σημαίνει «πλήρες» σε όλο το hub (D11).
const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const LOAD_STEP = REDUCE_MOTION ? 120 : 350, LOAD_MIN_READ = REDUCE_MOTION ? 200 : 650, LOAD_READY = REDUCE_MOTION ? 200 : 650;
const pause = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const loadRow = (i) => document.querySelector(`.load-row[data-step="${i}"]`);
function loadActivate(i) { const r = loadRow(i); if (r) r.classList.remove('opacity-50'); }
function loadSet(i, pct) { const b = loadRow(i) && loadRow(i).querySelector('[data-load-bar]'); if (b) b.style.width = `${pct}%`; }
function loadDone(i) {
    const r = loadRow(i); if (!r) return;
    const b = r.querySelector('[data-load-bar]');
    b.style.width = '100%'; b.classList.remove('bg-acc-500'); b.classList.add('bg-emerald-500');
    r.querySelector('[data-load-ck]').classList.remove('opacity-0');
}
async function loadStep(i, work) {          // βήματα 2…6: δουλειά → γέμισμα → ✓
    loadActivate(i);
    await pause(20);
    // Ένα tab που αποτυγχάνει να ζωγραφιστεί δεν κλειδώνει όλη τη σελίδα πίσω από την οθόνη φόρτωσης:
    // το σφάλμα γράφεται στην κονσόλα και η εκκίνηση συνεχίζει με τα υπόλοιπα.
    try { await work(); } catch (err) { console.error(`Σφάλμα στο βήμα ${i}:`, err); }
    const b = loadRow(i).querySelector('[data-load-bar]');
    b.style.transitionDuration = `${LOAD_STEP}ms`; b.style.transitionTimingFunction = 'linear'; b.style.width = '100%';
    await pause(LOAD_STEP);
    loadDone(i);
}

// Αν τα δεδομένα δεν φορτώσουν: η οθόνη μένει, σταματά το spinner και γράφει μήνυμα (όπως στο live).
function loadFailed(err) {
    console.error('Αποτυχία φόρτωσης δεδομένων:', err);
    const sp = document.getElementById('mainSpinner'); if (sp) sp.classList.add('hidden');
    const el = document.getElementById('loadError');
    if (el) { el.textContent = i18n[currentLang].load.error; el.classList.remove('hidden'); }
}

async function getJSON(path, opts) {
    const r = await fetch(path, opts);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
}

async function boot() {
    // Γλώσσα (kp_lang): κείμενα, κουμπιά GR | EN και ετικέτες της οθόνης φόρτωσης (δεν ζωγραφίζει tabs πριν έρθουν τα δεδομένα)
    try { setLang(currentLang); } catch (e) { console.warn('Αποτυχία εφαρμογής γλώσσας:', e); }
    try {
        // Βήμα 1: πραγματική πρόοδος (3 αρχεία: meta, ιστορικό, ανασκόπηση), με ελάχιστο χρόνο ανάγνωσης· cache: 'no-cache' (ETag): πλήρης λήψη μόνο όταν αλλάζει το αρχείο (D41)
        loadActivate(1);
        const t0 = Date.now();
        const files = [
            getJSON('data/meta.json', { cache: 'no-cache' }).catch((e) => { console.warn('meta.json δεν φορτώθηκε:', e); return null; }),   // όχι κρίσιμο
            getJSON(API_URL, { cache: 'no-cache' }),
            getJSON('data/review.json', { cache: 'no-cache' }).catch((e) => { console.warn('review.json δεν φορτώθηκε:', e); return null; })   // μη κρίσιμο: τα boxes δείχνουν μήνυμα
        ];
        let done = 0;
        const [meta, json, review] = await Promise.all(files.map((p) => p.then((v) => { loadSet(1, Math.round(++done / files.length * 100)); return v; })));
        if (!json || !Array.isArray(json.isp_generation) || json.isp_generation.length === 0) throw new Error('historical.json is empty');
        applyData(json);
        applyMeta(meta);
        reviewData = (review && review.days) ? review : null; reviewState = reviewData ? 'ready' : 'error';
        await pause(Math.max(0, LOAD_MIN_READ - (Date.now() - t0)));
        loadDone(1);
        await pause(LOAD_STEP);

        // Βήματα 2…6: ένα ανά tab, με τη σειρά των tabs
        if (typeof applyDataColors === 'function') applyDataColors();
        initExtraSelectors();
        paintTabs();
        await loadStep(2, async () => { updateOverviewTab(); });
        await loadStep(3, async () => { updateEconomicsTab(); });
        await loadStep(4, async () => { updateMonthlyTab(); });
        await loadStep(5, async () => { updateSurplusTab(); });
        await loadStep(6, async () => { updateReviewTab(); });
        appReady = true;

        document.getElementById('mainSpinner').classList.add('hidden');
        document.getElementById('loadRowFinal').classList.remove('opacity-0', 'translate-y-2');
        await pause(LOAD_READY);
        const ov = document.getElementById('loading-overlay');
        ov.classList.add('opacity-0');
        setTimeout(() => { ov.style.display = 'none'; }, 500);
    } catch (err) { loadFailed(err); }
}

document.addEventListener('DOMContentLoaded', boot);
