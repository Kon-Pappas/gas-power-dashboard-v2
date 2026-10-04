// =========================================================================
// DATA FETCHING & NORMALIZATION (data.js) - SERVERLESS ARCHITECTURE
// =========================================================================

// Πλέον το dashboard διαβάζει απευθείας το παραγόμενο JSON αρχείο
const API_URL = "data/historical.json"; 

let rawData = { 
    isp: [], 
    scada: [], 
    scadaHourly: [], 
    henex: [], 
    mcpHourly: [], 
    efficiency: [],
    daily_surplus: [],          
    daily_gas_constraints: [],
    daily_economics: []    
};

let currentLang = 'en'; 

const i18n = {
    en: {
        title: "Greek Gas-to-Power Market Analytics",
        source: "Data source: IPTO (ADMIE) & HEnEx official reports",
        scopeTooltip: "Refers exclusively to natural gas fired power plants (CCGT/OCGT) in the Greek Interconnected System.",
        lastUpdate: "Last Update:",
        nextUpdate: "Next Update:",
        lastUpdateMobile: "Updated:",
        nextUpdateMobile: "Next:",
        dateLabel: "Date:",
        tabOverview: "Daily Overview",
        tabEconomics: "Daily Economics",
        tabIspScada: "Monthly Analytics",
        tabSurplus: "Generic Constraints & Surplus",
        btnMethodology: "Methodology & Assumptions",
        btnClose: "Close",
        modalTitle: "Methodology & Core Assumptions",
        btnShort: "Short",
        btnDetailed: "Detailed",
        modalBodyShort: `
            <p class="mb-3">An independent tool for monitoring natural gas power plants in the Greek market, built on open data. Figures are estimates and indications, not official statistics.</p>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">All Tabs</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Scope:</strong> gas-fired (CCGT) units on the Transmission System (IPTO/ADMIE) that appear in its files. Lignite units (e.g. Ptolemaida5) and large hydro (e.g. Agras) are excluded even where present in the same source files.</li>
                <li><strong class="text-slate-200">Sources:</strong> IPTO/ADMIE (ISP = schedule, SCADA = actual operation, published the next morning) and HEnEx (gas price indices, Day-Ahead Market price). Updated daily; the last 10 days are re-checked to catch late publications.</li>
                <li><strong class="text-slate-200">Pending data:</strong> a day with no SCADA yet is marked "Pending SCADA" and shown using ISP only. A day with no HGSIDA yet has its economics deferred to the next run rather than shown incomplete.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Daily Overview</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> the ISP shows what was scheduled, SCADA what actually happened. Differences between them are expected.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Daily Economics</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Cost model:</strong> a theoretical cost, not realized revenue — one reference gas index (HGSIDA) and a standardized CO2 cost per unit class.</li>
                <li><strong class="text-slate-200">CO2 price:</strong> when a real price isn't available, we use the last known real price (weekends) or a flat €85.00 (if none exists), marked "estimated".</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Generic Constraints & Surplus</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Out-of-merit proxy:</strong> a unit running while MCP is below its fuel cost is shown as constraint-driven, approximating residual ISP surplus. An imperfect proxy — the true surplus can't be independently verified.</li>
                <li><strong class="text-slate-200">Pending days excluded:</strong> only days without SCADA are left out of the chart; days with zero constraints or near-zero surplus stay in.</li>
            </ul>
        `,
        modalBodyDetailed: `
            <p class="mb-3">This Dashboard is an independent tool for monitoring and analyzing natural gas power plants in the Greek Energy Market, built and maintained by a single analyst, on open data. Figures are estimates and indications, not official statistics.</p>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">All Tabs</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Scope:</strong> refers exclusively to natural gas (CCGT) power plants connected to the Transmission System (IPTO/ADMIE) that appear in its published files. Lignite units (e.g. Ptolemaida5) and large hydro (e.g. Agras) are excluded even when they appear in the same source files as the gas units. Co-generation units with locked 24/7 output (e.g. Alouminio) are likewise excluded from constraint tracking, since their output isn't market-responsive.</li>
                <li><strong class="text-slate-200">Sources:</strong> Data is fetched daily from IPTO's (ADMIE) official reports (ISP & SCADA) and HEnEx (Day-Ahead Market & NGAS Indices).</li>
                <li><strong class="text-slate-200">Updates:</strong> daily in the morning via a scheduled job. The last 10 days are re-checked on every run to catch late publications and corrections.</li>
                <li><strong class="text-slate-200">Data Completeness:</strong> SCADA telemetry for a given day is published by IPTO the following morning; until then, that day is marked "Pending SCADA" and shown using ISP data only. Similarly, when HGSIDA hasn't been published yet for the current day (HEnEx typically publishes later in the day), that day's economics are deferred entirely to the next run rather than calculated with an incomplete or zero value.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Daily Overview</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> the ISP shows what was scheduled, SCADA what actually happened. Differences between them are expected and often meaningful — large gaps can indicate last-minute re-dispatch or constraint activity.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Daily Economics</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Economics & Fuel Cost:</strong> Production cost is theoretically calculated using the daily HEnEx TTF (HGSIDA) index, divided by the specific Thermal Efficiency of each unit class, plus the standardized CO2 emission cost. HGSIDA is used uniformly across all units and hours as a simplifying assumption — HEnEx publishes several distinct gas price indices (HGSIDA, HGMBI, HGMSI, HGSIWD), and there is no public data indicating which index, if any, actually applied to a given unit's gas procurement at a given time.</li>
                <li><strong class="text-slate-200">Dynamic Fuel Cost Model:</strong> Fuel cost is not a single daily number per unit — it is recalculated separately for each hour, based on that hour's actual SCADA output. Each unit has an assumed technical minimum and nameplate maximum (MW), and an assumed efficiency and CO2 intensity at each of those two points. For a given hour, the model locates the unit's actual output linearly between its minimum and maximum, and uses that same position to linearly interpolate both its efficiency and its CO2 emission factor for that hour — a unit running near its technical minimum is assumed less efficient (and more carbon-intensive per MWh) than the same unit running near full load. Hourly fuel cost is then HGSIDA divided by that hour's interpolated efficiency, multiplied by the hour's MWh; CO2 cost follows the same hourly logic. The key simplifying assumption is linearity: real CCGT heat-rate curves are typically non-linear, with efficiency gains concentrated closer to full load — this model treats the relationship as a straight line between the two known points, in the absence of publicly available, unit-specific heat-rate curves. For any unit without published technical specifications, a generic fallback profile is used instead of unit-specific values.</li>
                <li><strong class="text-slate-200">CO2 price & estimates:</strong> when a real EUA CO2 price isn't available for a given date, the dashboard deliberately defaults to the last known real price on weekends (the market is closed, so the previous real close is carried forward) or, if none exists at all, a flat placeholder (€85.00/t) — rather than leaving the calculation incomplete. Either case is marked with an "estimated" badge next to the price, and affects the fuel cost calculation for that day only.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Generic Constraints & Surplus</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Out-of-Merit Operation:</strong> Due to the "duck curve" and high RES penetration, IPTO frequently keeps units synchronized via Generic Constraints for system stability. When a unit generates electricity while the Day-Ahead Market (MCP) price is lower than its marginal fuel cost, this is visualized as constraint-driven operation — not market-driven arbitrage. In practice, this is the only available way to approximate the residual surplus left over from the ISP's day-ahead scheduling, though it is an imperfect proxy, since the true magnitude of that residual surplus cannot be independently verified from public data.</li>
                <li><strong class="text-slate-200">Which units count:</strong> only gas-fired units are tracked for constraints; lignite and large hydro units appearing in the same ISP file are filtered out, as is the co-generation unit with locked 24/7 output.</li>
                <li><strong class="text-slate-200">Pending days vs. zero days:</strong> a day is excluded from the chart only when SCADA isn't available yet for it. A day with SCADA but zero recorded constraints, or with very low residual surplus, remains in the chart and is shown as zero — it is not treated the same as a pending day.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Limitations</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Data:</strong> SCADA data is published as preliminary/uncertified by IPTO and may be revised. The ISP is a schedule, not a measurement of actual delivery.</li>
                <li><strong class="text-slate-200">Cost model:</strong> relies on a single simplified gas price reference (HGSIDA) rather than unit-specific procurement data, and does not reflect each unit's actual realized revenue or market settlement.</li>
                <li><strong class="text-slate-200">Nature:</strong> this is an independent analysis of open data. It is not the official position of IPTO/ADMIE, HEnEx, or any other organisation.</li>
            </ul>
        `
    },
    el: {
        title: "Ανάλυση Ελληνικής Αγοράς Φυσικού Αερίου",
        source: "Πηγή δεδομένων: Επίσημα αρχεία ΑΔΜΗΕ (IPTO) & ΕΧΕ (HEnEx)",
        scopeTooltip: "Αφορά αποκλειστικά τις μονάδες ηλεκτροπαραγωγής από Φυσικό Αέριο (CCGT/OCGT) στο Διασυνδεδεμένο Σύστημα.",
        lastUpdate: "Τελευταία Ενημέρωση:",
        nextUpdate: "Επόμενη Ενημέρωση:",
        lastUpdateMobile: "Ενημερώθηκε:",
        nextUpdateMobile: "Επόμενη:",
        dateLabel: "Ημερομηνία:",
        tabOverview: "Ημερήσια Επισκόπηση",
        tabEconomics: "Ημερήσια Οικονομικά",
        tabIspScada: "Μηνιαία Ανάλυση",
        tabSurplus: "Περιορισμοί Συστήματος & Πλεόνασμα",
        btnMethodology: "Μεθοδολογία & Παραδοχές",
        btnClose: "Κλείσιμο",
        modalTitle: "Μεθοδολογία & Βασικές Παραδοχές",
        btnShort: "Σύντομη",
        btnDetailed: "Αναλυτική",
        modalBodyShort: `
            <p class="mb-3">Ένα ανεξάρτητο εργαλείο παρακολούθησης μονάδων φυσικού αερίου στην Ελληνική Αγορά Ενέργειας, χτισμένο πάνω σε ανοιχτά δεδομένα. Τα νούμερα είναι εκτιμήσεις και ενδείξεις, όχι επίσημη στατιστική.</p>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Όλα τα Tabs</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Εύρος:</strong> μονάδες φυσικού αερίου (CCGT) στο Σύστημα Μεταφοράς (ΑΔΜΗΕ) που εμφανίζονται στα αρχεία του. Λιγνιτικές μονάδες (π.χ. Πτολεμαΐδα5) και μεγάλα υδροηλεκτρικά (π.χ. Άγρας) εξαιρούνται, ακόμα κι όταν εμφανίζονται στα ίδια αρχεία-πηγές.</li>
                <li><strong class="text-slate-200">Πηγές:</strong> ΑΔΜΗΕ (ISP = πρόγραμμα, SCADA = πραγματική λειτουργία, δημοσιεύεται το επόμενο πρωί) και HEnEx (δείκτες τιμής αερίου, τιμή Αγοράς Επόμενης Ημέρας). Ενημέρωση καθημερινά· οι τελευταίες 10 μέρες επανελέγχονται για καθυστερημένες δημοσιεύσεις.</li>
                <li><strong class="text-slate-200">Ελλιπή δεδομένα:</strong> μέρα χωρίς SCADA ακόμα σημειώνεται "Pending SCADA" και δείχνεται μόνο με ISP. Μέρα χωρίς HGSIDA ακόμα αναβάλλει τα economics για το επόμενο run, αντί να δείχνει ελλιπή εγγραφή.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Ημερήσια Επισκόπηση</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> το ISP δείχνει τι προγραμματίστηκε, το SCADA τι πραγματικά συνέβη. Διαφορές ανάμεσά τους είναι αναμενόμενες.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Ημερήσια Οικονομικά</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Μοντέλο κόστους:</strong> θεωρητικό κόστος, όχι πραγματικό έσοδο — ένας ενιαίος δείκτης αναφοράς αερίου (HGSIDA) και τυποποιημένο κόστος CO2 ανά κλάση μονάδας.</li>
                <li><strong class="text-slate-200">Τιμή CO2:</strong> όταν δεν υπάρχει διαθέσιμη πραγματική τιμή, χρησιμοποιείται η τελευταία γνωστή πραγματική τιμή (Σαββατοκύριακα) ή σταθερή τιμή €85.00 (αν δεν υπάρχει καμία), με ένδειξη "εκτίμηση".</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Περιορισμοί Συστήματος & Πλεόνασμα</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Out-of-merit ως proxy:</strong> μονάδα που λειτουργεί ενώ η MCP είναι χαμηλότερη από το κόστος καυσίμου της δείχνεται ως constraint-driven, προσεγγίζοντας το residual surplus του ISP. Ατελές proxy — το πραγματικό surplus δεν επαληθεύεται ανεξάρτητα.</li>
                <li><strong class="text-slate-200">Εξαιρούνται μόνο οι pending μέρες:</strong> μόνο μέρες χωρίς SCADA μένουν εκτός γραφήματος· μέρες με μηδενικά constraints ή σχεδόν μηδενικό surplus εξακολουθούν να απεικονίζονται κανονικά.</li>
            </ul>
        `,
        modalBodyDetailed: `
            <p class="mb-3">Αυτό το Dashboard είναι ένα ανεξάρτητο εργαλείο παρακολούθησης και ανάλυσης μονάδων φυσικού αερίου στην Ελληνική Αγορά Ενέργειας, το οποίο χτίζεται και συντηρείται από έναν μόνο αναλυτή, πάνω σε ανοιχτά δεδομένα. Τα νούμερα είναι εκτιμήσεις και ενδείξεις, όχι επίσημη στατιστική.</p>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Όλα τα Tabs</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Εύρος:</strong> αφορά αποκλειστικά μονάδες φυσικού αερίου (CCGT) συνδεδεμένες στο Σύστημα Μεταφοράς (ΑΔΜΗΕ) που εμφανίζονται στα δημοσιευμένα αρχεία του. Λιγνιτικές μονάδες (π.χ. Πτολεμαΐδα5) και μεγάλα υδροηλεκτρικά (π.χ. Άγρας) εξαιρούνται ακόμα κι όταν εμφανίζονται στα ίδια αρχεία-πηγές με τις μονάδες αερίου. Μονάδες συμπαραγωγής με κλειδωμένη παραγωγή 24/7 (π.χ. Αλουμίνιο) εξαιρούνται επίσης από την παρακολούθηση constraints, αφού η παραγωγή τους δεν ανταποκρίνεται στην αγορά.</li>
                <li><strong class="text-slate-200">Πηγές Δεδομένων:</strong> Αντλούνται καθημερινά από τον ΑΔΜΗΕ (ISP & SCADA) και το HEnEx (Day-Ahead Market & Δείκτες NGAS).</li>
                <li><strong class="text-slate-200">Ενημερώσεις:</strong> καθημερινά το πρωί, μέσω προγραμματισμένης εργασίας. Οι τελευταίες 10 μέρες επανελέγχονται σε κάθε run για καθυστερημένες δημοσιεύσεις και διορθώσεις.</li>
                <li><strong class="text-slate-200">Πληρότητα Δεδομένων:</strong> Τα δεδομένα SCADA για μια ημέρα δημοσιεύονται από τον ΑΔΜΗΕ το επόμενο πρωί· μέχρι τότε η ημέρα εμφανίζεται ως "Pending SCADA" με βάση μόνο τα δεδομένα ISP. Αντίστοιχα, όταν το HGSIDA δεν έχει δημοσιευτεί ακόμα για τη σημερινή μέρα (το HEnEx συνήθως δημοσιεύει αργότερα μέσα στη μέρα), τα economics της μέρας αναβάλλονται εξολοκλήρου για το επόμενο run, αντί να υπολογιστούν με ελλιπή ή μηδενική τιμή.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Ημερήσια Επισκόπηση</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> το ISP δείχνει τι προγραμματίστηκε, το SCADA τι πραγματικά συνέβη. Διαφορές ανάμεσά τους είναι αναμενόμενες και συχνά σημαντικές — μεγάλα χάσματα μπορεί να υποδεικνύουν re-dispatch της τελευταίας στιγμής ή δραστηριότητα constraints.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Ημερήσια Οικονομικά</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Κόστος Παραγωγής:</strong> Υπολογίζεται θεωρητικά βάσει του δείκτη HEnEx (HGSIDA), διαιρούμενου με τον Βαθμό Απόδοσης της εκάστοτε κλάσης, προσθέτοντας το κόστος ρύπων CO2. Η HGSIDA χρησιμοποιείται ενιαία για όλες τις μονάδες και ώρες ως παραδοχή απλοποίησης — το HEnEx δημοσιεύει πολλαπλούς διακριτούς δείκτες τιμής αερίου (HGSIDA, HGMBI, HGMSI, HGSIWD), και δεν υπάρχουν δημόσια στοιχεία που να δείχνουν ποιος δείκτης, αν κάποιος, ίσχυσε πραγματικά για την προμήθεια αερίου συγκεκριμένης μονάδας σε συγκεκριμένη ώρα.</li>
                <li><strong class="text-slate-200">Δυναμικό Μοντέλο Κόστους Καυσίμου:</strong> Το κόστος καυσίμου δεν είναι ένα ενιαίο ημερήσιο νούμερο ανά μονάδα — υπολογίζεται ξεχωριστά για κάθε ώρα, βάσει της πραγματικής παραγωγής SCADA εκείνης της ώρας. Κάθε μονάδα έχει ένα παραδοχικό τεχνικό ελάχιστο και ονομαστικό μέγιστο (MW), και μια παραδοχική απόδοση και ένταση CO2 σε αυτά τα δύο άκρα. Για μια δεδομένη ώρα, το μοντέλο εντοπίζει την πραγματική παραγωγή γραμμικά ανάμεσα στο ελάχιστο και το μέγιστο, και με την ίδια αυτή θέση παρεμβάλλει γραμμικά τόσο την απόδοση όσο και τον συντελεστή εκπομπών CO2 της ώρας — μονάδα που λειτουργεί κοντά στο τεχνικό της ελάχιστο θεωρείται λιγότερο αποδοτική (και πιο ρυπογόνα ανά MWh) από την ίδια μονάδα σε πλήρες φορτίο. Το ωριαίο κόστος καυσίμου προκύπτει διαιρώντας την HGSIDA με την παρεμβαλλόμενη απόδοση της ώρας, επί τα MWh της ώρας· το κόστος CO2 ακολουθεί την ίδια ωριαία λογική. Η βασική παραδοχή απλοποίησης είναι η γραμμικότητα: οι πραγματικές καμπύλες heat-rate των CCGT δεν είναι συνήθως γραμμικές — το μοντέλο αντιμετωπίζει τη σχέση ως ευθεία γραμμή ανάμεσα στα δύο γνωστά άκρα, ελλείψει δημόσια διαθέσιμων, ανά-μονάδα καμπυλών heat-rate. Για μονάδα χωρίς δημοσιευμένα τεχνικά χαρακτηριστικά, χρησιμοποιείται γενικό προφίλ αντί για εξειδικευμένες τιμές.</li>
                <li><strong class="text-slate-200">Τιμή CO2 & εκτιμήσεις:</strong> όταν δεν υπάρχει διαθέσιμη πραγματική τιμή CO2 (EUA) για μια ημερομηνία, το dashboard συνειδητά καταφεύγει στην τελευταία γνωστή πραγματική τιμή τα Σαββατοκύριακα (η αγορά είναι κλειστή, οπότε το προηγούμενο πραγματικό κλείσιμο μεταφέρεται) ή, αν δεν υπάρχει καμία τιμή, σε μια σταθερή τιμή αναφοράς (€85.00/τόνο) — αντί να αφήσει τον υπολογισμό ελλιπή. Και οι δύο περιπτώσεις σημειώνονται με ένδειξη "εκτίμηση" δίπλα στην τιμή, και επηρεάζουν μόνο το κόστος καυσίμου εκείνης της ημέρας.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Περιορισμοί Συστήματος & Πλεόνασμα</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Λειτουργία Out-of-Merit:</strong> Λόγω υψηλής διείσδυσης ΑΠΕ, ο ΑΔΜΗΕ διατηρεί συχνά μονάδες συγχρονισμένες μέσω Generic Constraints για ευστάθεια συστήματος. Η λειτουργία μονάδας σε ώρες όπου η Τιμή Εκκαθάρισης (MCP) είναι χαμηλότερη από το κόστος καυσίμου της, αποτυπώνεται ως constraint-driven λειτουργία — όχι ως market-driven arbitrage. Στην πράξη, αυτός είναι ο μόνος διαθέσιμος τρόπος προσέγγισης του residual surplus που απομένει από τον ημερήσιο προγραμματισμό (ISP), αν και πρόκειται για ατελές proxy, καθώς το πραγματικό μέγεθος αυτού του πλεονάσματος δεν μπορεί να επιβεβαιωθεί ανεξάρτητα από δημόσια δεδομένα.</li>
                <li><strong class="text-slate-200">Ποιες μονάδες μετράνε:</strong> παρακολουθούνται μόνο μονάδες φυσικού αερίου· λιγνιτικές και μεγάλα υδροηλεκτρικά που εμφανίζονται στο ίδιο αρχείο ISP φιλτράρονται έξω, όπως και η μονάδα συμπαραγωγής με κλειδωμένη 24/7 παραγωγή.</li>
                <li><strong class="text-slate-200">Pending μέρες vs μηδενικές μέρες:</strong> μια μέρα εξαιρείται από το γράφημα μόνο όταν δεν υπάρχει ακόμα SCADA γι' αυτήν. Μέρα με SCADA αλλά μηδενικά καταγεγραμμένα constraints, ή με πολύ χαμηλό residual surplus, παραμένει στο γράφημα και δείχνεται ως μηδέν — δεν αντιμετωπίζεται όπως μια pending μέρα.</li>
            </ul>

            <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 mt-4">Περιορισμοί</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Δεδομένα:</strong> Τα δεδομένα SCADA δημοσιεύονται από τον ΑΔΜΗΕ ως προκαταρκτικά/μη πιστοποιημένα και μπορεί να αναθεωρηθούν. Το ISP είναι πρόγραμμα, όχι μέτρηση πραγματικής παράδοσης.</li>
                <li><strong class="text-slate-200">Μοντέλο κόστους:</strong> βασίζεται σε έναν ενιαίο, απλοποιημένο δείκτη τιμής αερίου (HGSIDA) αντί για δεδομένα προμήθειας ανά μονάδα, και δεν αντανακλά το πραγματικό πραγματοποιηθέν έσοδο ή τον διακανονισμό αγοράς κάθε μονάδας.</li>
                <li><strong class="text-slate-200">Φύση:</strong> πρόκειται για ανεξάρτητη ανάλυση ανοιχτών δεδομένων. Δεν αποτελεί επίσημη θέση του ΑΔΜΗΕ, του HEnEx, ή οποιουδήποτε άλλου οργανισμού.</li>
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
    }
    const btnShort = document.getElementById('btnMethodologyShort');
    const btnDetailed = document.getElementById('btnMethodologyDetailed');
    if (btnShort && btnDetailed) {
        btnShort.innerText = t.btnShort;
        btnDetailed.innerText = t.btnDetailed;
        const active = "flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white transition";
        const inactive = "flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 transition";
        btnShort.className = methodologyDepth === 'short' ? active : inactive;
        btnDetailed.className = methodologyDepth === 'detailed' ? active : inactive;
    }
}

function setMethodologyDepth(depth) {
    methodologyDepth = depth;
    renderMethodologyModal();
}

function setLang(lang) {
    currentLang = lang;
    const t = i18n[lang];
    
    document.getElementById('pageTitle').innerText = t.title;
    document.getElementById('mainTitle').innerText = t.title;
    document.getElementById('lastUpdateLabel').innerText = t.lastUpdateMobile || t.lastUpdate;
    document.getElementById('nextUpdateLabel').innerText = t.nextUpdateMobile || t.nextUpdate;
    document.getElementById('lastUpdateLabelDesktop').innerText = t.lastUpdate;
    document.getElementById('nextUpdateLabelDesktop').innerText = t.nextUpdate;
    
    if(document.getElementById('btnMethodologyText')) document.getElementById('btnMethodologyText').innerText = t.btnMethodology;
    renderMethodologyModal();
    if(document.getElementById('btnClose')) document.getElementById('btnClose').innerText = t.btnClose;

    document.getElementById('tabBtnOverview').innerText = t.tabOverview;
    document.getElementById('tabBtnEconomics').innerText = t.tabEconomics;
    document.getElementById('tabBtnIspScada').innerText = t.tabIspScada;
    document.getElementById('tabBtnSurplus').innerText = t.tabSurplus;
    
    if(document.getElementById('dateLabel')) document.getElementById('dateLabel').innerText = t.dateLabel;

    if(lang === 'el') {
        document.getElementById('btnGr').className = "px-2 py-1 rounded bg-blue-600 text-white transition";
        document.getElementById('btnEn').className = "px-2 py-1 rounded text-slate-400 hover:text-white transition";
    } else {
        document.getElementById('btnEn').className = "px-2 py-1 rounded bg-blue-600 text-white transition";
        document.getElementById('btnGr').className = "px-2 py-1 rounded text-slate-400 hover:text-white transition";
    }

    if (typeof updateDashboard === "function") updateDashboard();
}

function updateFreshness(dates) {
    if (!dates || dates.length === 0) return;
    const latestDate = dates[0];
    let parts = latestDate.split('-');
    let formattedLatest = latestDate;
    let formattedNext = "-";
    
    if (parts.length === 3) {
        formattedLatest = `${parts[2]}/${parts[1]}/${parts[0]} 08:00`;
        let d = new Date(parts[0], parts[1] - 1, parseInt(parts[2]) + 1);
        let day = String(d.getDate()).padStart(2, '0');
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let year = d.getFullYear();
        formattedNext = `${day}/${month}/${year} 08:00`;
    }
    
    document.getElementById('lastUpdateVal').innerText = formattedLatest;
    document.getElementById('nextUpdateVal').innerText = formattedNext;
}

// ΑΣΦΑΛΗΣ & ΟΜΑΛΗ ΡΟΗ ΦΟΡΤΩΣΗΣ (BULLETPROOF FETCH ΓΙΑ ΤΟΠΙΚΟ ΑΡΧΕΙΟ)
async function fetchMarketData() {
    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('loading-progress-bar');
    const progressPercentage = document.getElementById('loading-percentage');
    const loadingSubtitle = document.getElementById('loading-subtitle');

    function updateProgress(percent, text) {
        if (progressBar) progressBar.style.width = percent + '%';
        if (progressPercentage) progressPercentage.innerText = percent + '%';
        if (loadingSubtitle) loadingSubtitle.innerText = text;
    }

    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';

    const texts = {
        en: [
            { p: 25, t: "Initializing local database..." },
            { p: 60, t: "Reading static JSON payload..." },
            { p: 90, t: "Processing and normalizing datasets..." }
        ],
        el: [
            { p: 25, t: "Αρχικοποίηση τοπικής βάσης..." },
            { p: 60, t: "Ανάγνωση στατικού JSON..." },
            { p: 90, t: "Επεξεργασία & κανονικοποίηση δεδομένων..." }
        ]
    };

    let stepIndex = 0;
    let activeSteps = texts[lang] || texts.en;
    updateProgress(activeSteps[0].p, activeSteps[0].t);

    let progressInterval = setInterval(() => {
        stepIndex++;
        if (stepIndex < activeSteps.length) {
            updateProgress(activeSteps[stepIndex].p, activeSteps[stepIndex].t);
        } else {
            clearInterval(progressInterval);
        }
    }, 300);

    try {
        const response = await fetch(API_URL + "?v=" + new Date().getTime());
        clearInterval(progressInterval);

        if (!response.ok) throw new Error("Network response was not ok");
        
        const json = await response.json();
        
        updateProgress(95, lang === 'el' ? "Τελικός συγχρονισμός γραφημάτων..." : "Finalizing chart datasets...");

        rawData.isp = json.isp_generation || [];
        rawData.scada = json.scada_generation || [];
        rawData.scadaHourly = json.scada_generation_hourly || [];
        rawData.henex = json.henex_indices || [];
        rawData.mcpHourly = json.dam_mcp_hourly || [];
        rawData.efficiency = json.thermal_efficiency || [];
        rawData.daily_surplus = json.daily_surplus || [];                
        rawData.daily_gas_constraints = json.daily_gas_constraints || []; 
        rawData.daily_economics = json.daily_economics || []; // <-- Προσθήκη για τα Οικονομικά
        
        console.log("Local Data successfully loaded:", rawData);

        const dates = [...new Set([
            ...rawData.isp.map(d => Object.values(d)[0]),
            ...rawData.scada.map(d => Object.values(d)[0])
        ])].filter(d => d).sort().reverse();
        
        const dateSelect = document.getElementById('dateSelect');
        if(dateSelect) {
            dateSelect.innerHTML = dates.map(d => `<option value="${d}">${d}</option>`).join('');
        }

        updateFreshness(dates);

        updateProgress(100, lang === 'el' ? "Ολοκλήρωση Dashboard..." : "Finalizing Dashboard...");

        // Τα δεδομένα είναι ΗΔΗ έτοιμα εδώ. Το waterfall animation (αν υπάρχει στη σελίδα) παίζει
        // καθαρά αισθητικά και ΑΥΤΟ πλέον είναι το ΜΟΝΟ σημείο που κρύβει το overlay και καλεί
        // setLang/updateDashboard -- όχι δύο ανεξάρτητα χρονόμετρα να παλεύουν για το ίδιο element.
        const finish = () => { if (typeof setLang === 'function') setLang(currentLang); };
        if (typeof runWaterfallLoader === 'function') {
            runWaterfallLoader(finish);
        } else if (overlay) {
            setTimeout(() => {
                overlay.classList.add('opacity-0');
                setTimeout(() => overlay.style.display = 'none', 300);
            }, 300);
            finish();
        } else {
            finish();
        }

    } catch (error) {
        clearInterval(progressInterval);
        console.error("Error loading local market data:", error);
        // ΔΙΟΡΘΩΣΗ: πριν, σε αποτυχία fetch το overlay έμενε ΚΟΛΛΗΜΕΝΟ στην οθόνη για πάντα
        // (το catch δεν το έκρυβε ποτέ), μπλοκάροντας κάθε κλικ στη σελίδα -- συμπεριλαμβανομένου
        // του κουμπιού Methodology. Τώρα δείχνουμε καθαρό μήνυμα σφάλματος ΜΕΣΑ στο ίδιο το
        // overlay, με δυνατότητα να το κλείσει ο χρήστης χειροκίνητα, αντί να μένει παγιδευμένος.
        if (overlay) {
            overlay.innerHTML = `
                <div class="max-w-sm text-center px-4">
                    <div class="text-rose-400 text-lg font-bold mb-2">Σφάλμα φόρτωσης δεδομένων</div>
                    <div class="text-slate-400 text-sm mb-4">Το historical.json δεν βρέθηκε ή απέτυχε η φόρτωση. Δοκίμασε ανανέωση της σελίδας.</div>
                    <button onclick="document.getElementById('loading-overlay').style.display='none'" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-600 transition">Κλείσιμο</button>
                </div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', fetchMarketData);
