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
    efficiency: [],
    daily_surplus: [],          
    daily_gas_constraints: [],
    daily_economics: []    
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
        tabOverview: "Daily Overview",
        tabEconomics: "Daily Economics",
        tabIspScada: "Monthly Analytics",
        tabSurplus: "Generic Constraints & Surplus",
        btnMethodology: "Methodology & Assumptions",
        btnMethodologyShort: "Methodology",
        locale: "en-GB",
        today: "today",
        monthLabel: "Month:",
        pillComplete: "Complete data",
        pillCompleteShort: "Complete",
        pillPending: "Pending SCADA",
        pillPendingShort: "Pending",
        btnClose: "Close",
        modalTitle: "Methodology & Core Assumptions",
        btnShort: "Short",
        btnDetailed: "Detailed",
        modalBodyShort: `
            <p class="mb-3">An independent tool for monitoring natural gas power plants in the Greek market, built on open data. Figures are estimates and indications, not official statistics.</p>

            <p data-sec="all" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">All Tabs</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Scope:</strong> gas-fired (CCGT) units on the Transmission System (IPTO/ADMIE) that appear in its files. Lignite units (e.g. Ptolemaida5) and large hydro (e.g. Agras) are excluded even where present in the same source files.</li>
                <li><strong class="text-slate-200">Sources:</strong> IPTO/ADMIE (ISP = schedule, SCADA = actual operation, published the next morning) and HEnEx (gas price indices). Updated twice daily (07:06 and 13:00, Greek time); the last 10 days are re-checked to catch late publications.</li>
                <li><strong class="text-slate-200">Pending data:</strong> a day with no SCADA yet is marked "Pending SCADA" and shown using ISP only. A day with no HGSIDA yet has its economics deferred to the next run rather than shown incomplete.</li>
            </ul>

            <p data-sec="overview" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Daily Overview</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> the ISP shows what was scheduled, SCADA what actually happened. Differences between them are expected.</li>
            </ul>

            <p data-sec="economics" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Daily Economics</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Cost model:</strong> a theoretical cost, not realized revenue — one reference gas index (HGSIDA) and a standardized CO2 cost per unit class.</li>
                <li><strong class="text-slate-200">CO2 price:</strong> when a real price isn't available, we use the last known real price (weekends) or a flat €85.00 (if none exists), marked "estimated".</li>
            </ul>

            <p data-sec="surplus" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Generic Constraints & Surplus</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Constraint-driven generation:</strong> the SCADA output of a gas unit during the hours IPTO's ISP2 lists it under a Generic Constraint. It approximates the residual ISP surplus; an imperfect proxy — the true surplus can't be independently verified.</li>
                <li><strong class="text-slate-200">Pending days excluded:</strong> only days without SCADA are left out of the chart; days with zero constraints or near-zero surplus stay in.</li>
            </ul>
        `,
        modalBodyDetailed: `
            <p class="mb-3">This Dashboard is an independent tool for monitoring and analyzing natural gas power plants in the Greek Energy Market, built and maintained by a single analyst, on open data. Figures are estimates and indications, not official statistics.</p>

            <p data-sec="all" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">All Tabs</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Scope:</strong> refers exclusively to natural gas (CCGT) power plants connected to the Transmission System (IPTO/ADMIE) that appear in its published files. Lignite units (e.g. Ptolemaida5) and large hydro (e.g. Agras) are excluded even when they appear in the same source files as the gas units. Co-generation units with locked 24/7 output (e.g. Alouminio) are likewise excluded from constraint tracking, since their output isn't market-responsive.</li>
                <li><strong class="text-slate-200">Sources:</strong> Data is fetched daily from IPTO's (ADMIE) official reports (ISP & SCADA) and HEnEx (NGAS gas price indices).</li>
                <li><strong class="text-slate-200">Updates:</strong> twice daily, at 07:06 and 13:00 Greek time, via a scheduled job. The last 10 days are re-checked on every run to catch late publications and corrections.</li>
                <li><strong class="text-slate-200">Data Completeness:</strong> SCADA telemetry for a given day is published by IPTO the following morning; until then, that day is marked "Pending SCADA" and shown using ISP data only. Similarly, HEnEx publishes the HGSIDA index for a given day on the following day, by around midday; until it appears, that day's economics are deferred entirely to the next run rather than calculated with an incomplete or zero value.</li>
            </ul>

            <p data-sec="overview" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Daily Overview</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> the ISP shows what was scheduled, SCADA what actually happened. Differences between them are expected and often meaningful — large gaps can indicate last-minute re-dispatch or constraint activity.</li>
            </ul>

            <p data-sec="economics" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Daily Economics</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Economics & Fuel Cost:</strong> Production cost is theoretically calculated using the daily HEnEx TTF (HGSIDA) index, divided by the specific Thermal Efficiency of each unit class, plus the standardized CO2 emission cost. HGSIDA is used uniformly across all units and hours as a simplifying assumption — HEnEx publishes several distinct gas price indices (HGSIDA, HGMBI, HGMSI, HGSIWD), and there is no public data indicating which index, if any, actually applied to a given unit's gas procurement at a given time.</li>
                <li><strong class="text-slate-200">Dynamic Fuel Cost Model:</strong> Fuel cost is not a single daily number per unit — it is recalculated separately for each hour, based on that hour's actual SCADA output. Each unit has an assumed technical minimum and nameplate maximum (MW), and an assumed efficiency and CO2 intensity at each of those two points. For a given hour, the model locates the unit's actual output linearly between its minimum and maximum, and uses that same position to linearly interpolate both its efficiency and its CO2 emission factor for that hour — a unit running near its technical minimum is assumed less efficient (and more carbon-intensive per MWh) than the same unit running near full load. Hourly fuel cost is then HGSIDA divided by that hour's interpolated efficiency, multiplied by the hour's MWh; CO2 cost follows the same hourly logic. The key simplifying assumption is linearity: real CCGT heat-rate curves are typically non-linear, with efficiency gains concentrated closer to full load — this model treats the relationship as a straight line between the two known points, in the absence of publicly available, unit-specific heat-rate curves. For any unit without published technical specifications, a generic fallback profile is used instead of unit-specific values.</li>
                <li><strong class="text-slate-200">CO2 price & estimates:</strong> when a real EUA CO2 price isn't available for a given date, the dashboard deliberately defaults to the last known real price on weekends (the market is closed, so the previous real close is carried forward) or, if none exists at all, a flat placeholder (€85.00/t) — rather than leaving the calculation incomplete. Either case is marked with an "estimated" badge next to the price, and affects the fuel cost calculation for that day only.</li>
            </ul>

            <p data-sec="surplus" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Generic Constraints & Surplus</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Out-of-Merit Operation:</strong> Due to the "duck curve" and high RES penetration, IPTO frequently keeps units synchronized via Generic Constraints for system stability. The page takes the gas units and the hours of these constraints from the ISP2 schedule (its GenericConstraints sheet) and counts the unit's actual SCADA output inside those hours as constraint-driven generation — not market-driven arbitrage. Prices are not compared: a unit can also run below its cost for other reasons (technical minimum, block orders, balancing), and this view does not count those hours. In practice, this is the only available way to approximate the residual surplus left over from the ISP's scheduling, though it is an imperfect proxy, since the schedule is not a measurement and the true magnitude of that residual surplus cannot be independently verified from public data.</li>
                <li><strong class="text-slate-200">Which units count:</strong> only gas-fired units are tracked for constraints; lignite and large hydro units appearing in the same ISP file are filtered out, as is the co-generation unit with locked 24/7 output.</li>
                <li><strong class="text-slate-200">Pending days vs. zero days:</strong> a day is excluded from the chart only when SCADA isn't available yet for it. A day with SCADA but zero recorded constraints, or with very low residual surplus, remains in the chart and is shown as zero — it is not treated the same as a pending day.</li>
            </ul>

            <p data-sec="limits" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Limitations</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Data:</strong> SCADA data is published as preliminary/uncertified by IPTO and may be revised. The ISP is a schedule, not a measurement of actual delivery.</li>
                <li><strong class="text-slate-200">Cost model:</strong> relies on a single simplified gas price reference (HGSIDA) rather than unit-specific procurement data, and does not reflect each unit's actual realized revenue or market settlement.</li>
                <li><strong class="text-slate-200">Nature:</strong> this is an independent analysis of open data. It is not the official position of IPTO/ADMIE, HEnEx, or any other organisation.</li>
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
        tabOverview: "Ημερήσια Επισκόπηση",
        tabEconomics: "Ημερήσια Οικονομικά",
        tabIspScada: "Μηνιαία Ανάλυση",
        tabSurplus: "Περιορισμοί Συστήματος & Πλεόνασμα",
        btnMethodology: "Μεθοδολογία & Παραδοχές",
        btnMethodologyShort: "Μεθοδολογία",
        locale: "el-GR",
        today: "σήμερα",
        monthLabel: "Μήνας:",
        pillComplete: "Πλήρη δεδομένα",
        pillCompleteShort: "Πλήρη",
        pillPending: "Εκκρεμεί SCADA",
        pillPendingShort: "Εκκρεμεί",
        btnClose: "Κλείσιμο",
        modalTitle: "Μεθοδολογία & Βασικές Παραδοχές",
        btnShort: "Σύντομη",
        btnDetailed: "Αναλυτική",
        modalBodyShort: `
            <p class="mb-3">Ένα ανεξάρτητο εργαλείο παρακολούθησης μονάδων φυσικού αερίου στην Ελληνική Αγορά Ενέργειας, χτισμένο πάνω σε ανοιχτά δεδομένα. Τα νούμερα είναι εκτιμήσεις και ενδείξεις, όχι επίσημη στατιστική.</p>

            <p data-sec="all" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Όλα τα Tabs</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Εύρος:</strong> μονάδες φυσικού αερίου (CCGT) στο Σύστημα Μεταφοράς (ΑΔΜΗΕ) που εμφανίζονται στα αρχεία του. Λιγνιτικές μονάδες (π.χ. Πτολεμαΐδα5) και μεγάλα υδροηλεκτρικά (π.χ. Άγρας) εξαιρούνται, ακόμα κι όταν εμφανίζονται στα ίδια αρχεία-πηγές.</li>
                <li><strong class="text-slate-200">Πηγές:</strong> ΑΔΜΗΕ (ISP = πρόγραμμα, SCADA = πραγματική λειτουργία, δημοσιεύεται το επόμενο πρωί) και HEnEx (δείκτες τιμής αερίου). Ενημέρωση δύο φορές την ημέρα (07:06 και 13:00, ώρα Ελλάδος)· οι τελευταίες 10 μέρες επανελέγχονται για καθυστερημένες δημοσιεύσεις.</li>
                <li><strong class="text-slate-200">Ελλιπή δεδομένα:</strong> μέρα χωρίς SCADA ακόμα σημειώνεται "Pending SCADA" και δείχνεται μόνο με ISP. Μέρα χωρίς HGSIDA ακόμα αναβάλλει τα economics για το επόμενο run, αντί να δείχνει ελλιπή εγγραφή.</li>
            </ul>

            <p data-sec="overview" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Ημερήσια Επισκόπηση</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> το ISP δείχνει τι προγραμματίστηκε, το SCADA τι πραγματικά συνέβη. Διαφορές ανάμεσά τους είναι αναμενόμενες.</li>
            </ul>

            <p data-sec="economics" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Ημερήσια Οικονομικά</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Μοντέλο κόστους:</strong> θεωρητικό κόστος, όχι πραγματικό έσοδο — ένας ενιαίος δείκτης αναφοράς αερίου (HGSIDA) και τυποποιημένο κόστος CO2 ανά κλάση μονάδας.</li>
                <li><strong class="text-slate-200">Τιμή CO2:</strong> όταν δεν υπάρχει διαθέσιμη πραγματική τιμή, χρησιμοποιείται η τελευταία γνωστή πραγματική τιμή (Σαββατοκύριακα) ή σταθερή τιμή €85.00 (αν δεν υπάρχει καμία), με ένδειξη "εκτίμηση".</li>
            </ul>

            <p data-sec="surplus" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Περιορισμοί Συστήματος & Πλεόνασμα</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Constraint-driven παραγωγή:</strong> η παραγωγή SCADA μονάδας αερίου τις ώρες που το ISP2 του ΑΔΜΗΕ την έχει σε Generic Constraint. Προσεγγίζει το residual surplus του ISP· ατελές proxy — το πραγματικό surplus δεν επαληθεύεται ανεξάρτητα.</li>
                <li><strong class="text-slate-200">Εξαιρούνται μόνο οι pending μέρες:</strong> μόνο μέρες χωρίς SCADA μένουν εκτός γραφήματος· μέρες με μηδενικά constraints ή σχεδόν μηδενικό surplus εξακολουθούν να απεικονίζονται κανονικά.</li>
            </ul>
        `,
        modalBodyDetailed: `
            <p class="mb-3">Αυτό το Dashboard είναι ένα ανεξάρτητο εργαλείο παρακολούθησης και ανάλυσης μονάδων φυσικού αερίου στην Ελληνική Αγορά Ενέργειας, το οποίο χτίζεται και συντηρείται από έναν μόνο αναλυτή, πάνω σε ανοιχτά δεδομένα. Τα νούμερα είναι εκτιμήσεις και ενδείξεις, όχι επίσημη στατιστική.</p>

            <p data-sec="all" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Όλα τα Tabs</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Εύρος:</strong> αφορά αποκλειστικά μονάδες φυσικού αερίου (CCGT) συνδεδεμένες στο Σύστημα Μεταφοράς (ΑΔΜΗΕ) που εμφανίζονται στα δημοσιευμένα αρχεία του. Λιγνιτικές μονάδες (π.χ. Πτολεμαΐδα5) και μεγάλα υδροηλεκτρικά (π.χ. Άγρας) εξαιρούνται ακόμα κι όταν εμφανίζονται στα ίδια αρχεία-πηγές με τις μονάδες αερίου. Μονάδες συμπαραγωγής με κλειδωμένη παραγωγή 24/7 (π.χ. Αλουμίνιο) εξαιρούνται επίσης από την παρακολούθηση constraints, αφού η παραγωγή τους δεν ανταποκρίνεται στην αγορά.</li>
                <li><strong class="text-slate-200">Πηγές Δεδομένων:</strong> Αντλούνται καθημερινά από τον ΑΔΜΗΕ (ISP & SCADA) και το HEnEx (Δείκτες NGAS).</li>
                <li><strong class="text-slate-200">Ενημερώσεις:</strong> δύο φορές την ημέρα, στις 07:06 και στις 13:00 (ώρα Ελλάδος), μέσω προγραμματισμένης εργασίας. Οι τελευταίες 10 μέρες επανελέγχονται σε κάθε run για καθυστερημένες δημοσιεύσεις και διορθώσεις.</li>
                <li><strong class="text-slate-200">Πληρότητα Δεδομένων:</strong> Τα δεδομένα SCADA για μια ημέρα δημοσιεύονται από τον ΑΔΜΗΕ το επόμενο πρωί· μέχρι τότε η ημέρα εμφανίζεται ως "Pending SCADA" με βάση μόνο τα δεδομένα ISP. Αντίστοιχα, το HEnEx δημοσιεύει το HGSIDA μιας ημέρας την επόμενη, γύρω στο μεσημέρι· μέχρι τότε τα economics της ημέρας αναβάλλονται εξολοκλήρου για το επόμενο run, αντί να υπολογιστούν με ελλιπή ή μηδενική τιμή.</li>
            </ul>

            <p data-sec="overview" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Ημερήσια Επισκόπηση</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">ISP vs SCADA:</strong> το ISP δείχνει τι προγραμματίστηκε, το SCADA τι πραγματικά συνέβη. Διαφορές ανάμεσά τους είναι αναμενόμενες και συχνά σημαντικές — μεγάλα χάσματα μπορεί να υποδεικνύουν re-dispatch της τελευταίας στιγμής ή δραστηριότητα constraints.</li>
            </ul>

            <p data-sec="economics" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Ημερήσια Οικονομικά</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Κόστος Παραγωγής:</strong> Υπολογίζεται θεωρητικά βάσει του δείκτη HEnEx (HGSIDA), διαιρούμενου με τον Βαθμό Απόδοσης της εκάστοτε κλάσης, προσθέτοντας το κόστος ρύπων CO2. Η HGSIDA χρησιμοποιείται ενιαία για όλες τις μονάδες και ώρες ως παραδοχή απλοποίησης — το HEnEx δημοσιεύει πολλαπλούς διακριτούς δείκτες τιμής αερίου (HGSIDA, HGMBI, HGMSI, HGSIWD), και δεν υπάρχουν δημόσια στοιχεία που να δείχνουν ποιος δείκτης, αν κάποιος, ίσχυσε πραγματικά για την προμήθεια αερίου συγκεκριμένης μονάδας σε συγκεκριμένη ώρα.</li>
                <li><strong class="text-slate-200">Δυναμικό Μοντέλο Κόστους Καυσίμου:</strong> Το κόστος καυσίμου δεν είναι ένα ενιαίο ημερήσιο νούμερο ανά μονάδα — υπολογίζεται ξεχωριστά για κάθε ώρα, βάσει της πραγματικής παραγωγής SCADA εκείνης της ώρας. Κάθε μονάδα έχει ένα παραδοχικό τεχνικό ελάχιστο και ονομαστικό μέγιστο (MW), και μια παραδοχική απόδοση και ένταση CO2 σε αυτά τα δύο άκρα. Για μια δεδομένη ώρα, το μοντέλο εντοπίζει την πραγματική παραγωγή γραμμικά ανάμεσα στο ελάχιστο και το μέγιστο, και με την ίδια αυτή θέση παρεμβάλλει γραμμικά τόσο την απόδοση όσο και τον συντελεστή εκπομπών CO2 της ώρας — μονάδα που λειτουργεί κοντά στο τεχνικό της ελάχιστο θεωρείται λιγότερο αποδοτική (και πιο ρυπογόνα ανά MWh) από την ίδια μονάδα σε πλήρες φορτίο. Το ωριαίο κόστος καυσίμου προκύπτει διαιρώντας την HGSIDA με την παρεμβαλλόμενη απόδοση της ώρας, επί τα MWh της ώρας· το κόστος CO2 ακολουθεί την ίδια ωριαία λογική. Η βασική παραδοχή απλοποίησης είναι η γραμμικότητα: οι πραγματικές καμπύλες heat-rate των CCGT δεν είναι συνήθως γραμμικές — το μοντέλο αντιμετωπίζει τη σχέση ως ευθεία γραμμή ανάμεσα στα δύο γνωστά άκρα, ελλείψει δημόσια διαθέσιμων, ανά-μονάδα καμπυλών heat-rate. Για μονάδα χωρίς δημοσιευμένα τεχνικά χαρακτηριστικά, χρησιμοποιείται γενικό προφίλ αντί για εξειδικευμένες τιμές.</li>
                <li><strong class="text-slate-200">Τιμή CO2 & εκτιμήσεις:</strong> όταν δεν υπάρχει διαθέσιμη πραγματική τιμή CO2 (EUA) για μια ημερομηνία, το dashboard συνειδητά καταφεύγει στην τελευταία γνωστή πραγματική τιμή τα Σαββατοκύριακα (η αγορά είναι κλειστή, οπότε το προηγούμενο πραγματικό κλείσιμο μεταφέρεται) ή, αν δεν υπάρχει καμία τιμή, σε μια σταθερή τιμή αναφοράς (€85.00/τόνο) — αντί να αφήσει τον υπολογισμό ελλιπή. Και οι δύο περιπτώσεις σημειώνονται με ένδειξη "εκτίμηση" δίπλα στην τιμή, και επηρεάζουν μόνο το κόστος καυσίμου εκείνης της ημέρας.</li>
            </ul>

            <p data-sec="surplus" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Περιορισμοί Συστήματος & Πλεόνασμα</p>
            <ul class="list-disc pl-5 space-y-2 mb-2 text-slate-400">
                <li><strong class="text-slate-200">Λειτουργία Out-of-Merit:</strong> Λόγω υψηλής διείσδυσης ΑΠΕ, ο ΑΔΜΗΕ διατηρεί συχνά μονάδες συγχρονισμένες μέσω Generic Constraints για ευστάθεια συστήματος. Η σελίδα παίρνει τις μονάδες αερίου και τις ώρες αυτών των constraints από τον προγραμματισμό ISP2 (το φύλλο GenericConstraints) και μετρά την πραγματική παραγωγή SCADA της μονάδας μέσα σε αυτές τις ώρες ως constraint-driven παραγωγή — όχι ως market-driven arbitrage. Δεν συγκρίνονται τιμές: μια μονάδα μπορεί να λειτουργεί κάτω από το κόστος της και για άλλους λόγους (τεχνικό ελάχιστο, block orders, εξισορρόπηση), και αυτή η προβολή δεν μετρά εκείνες τις ώρες. Στην πράξη, αυτός είναι ο μόνος διαθέσιμος τρόπος προσέγγισης του residual surplus που απομένει από τον προγραμματισμό (ISP), αν και πρόκειται για ατελές proxy, καθώς ο προγραμματισμός δεν είναι μέτρηση και το πραγματικό μέγεθος αυτού του πλεονάσματος δεν μπορεί να επιβεβαιωθεί ανεξάρτητα από δημόσια δεδομένα.</li>
                <li><strong class="text-slate-200">Ποιες μονάδες μετράνε:</strong> παρακολουθούνται μόνο μονάδες φυσικού αερίου· λιγνιτικές και μεγάλα υδροηλεκτρικά που εμφανίζονται στο ίδιο αρχείο ISP φιλτράρονται έξω, όπως και η μονάδα συμπαραγωγής με κλειδωμένη 24/7 παραγωγή.</li>
                <li><strong class="text-slate-200">Pending μέρες vs μηδενικές μέρες:</strong> μια μέρα εξαιρείται από το γράφημα μόνο όταν δεν υπάρχει ακόμα SCADA γι' αυτήν. Μέρα με SCADA αλλά μηδενικά καταγεγραμμένα constraints, ή με πολύ χαμηλό residual surplus, παραμένει στο γράφημα και δείχνεται ως μηδέν — δεν αντιμετωπίζεται όπως μια pending μέρα.</li>
            </ul>

            <p data-sec="limits" class="text-[11px] font-bold text-acc-400 uppercase tracking-wider mb-2 mt-4">Περιορισμοί</p>
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
// Το tab Monthly Analytics δεν έχει δική του ενότητα ακόμα (K23): ανοίγει από την αρχή.
const METHOD_SEC = { overview: 'overview', economics: 'economics', ispScada: null, surplus: 'surplus' };
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

    // Οθόνη φόρτωσης: τα βήματα 2…5 παίρνουν τα ονόματα των tabs, με τη σειρά τους
    const L = t.load;
    const stepText = { 1: L.s1, 2: t.tabOverview, 3: t.tabEconomics, 4: t.tabIspScada, 5: t.tabSurplus };
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
    renderMethodologyModal();
    if(document.getElementById('btnClose')) document.getElementById('btnClose').innerText = t.btnClose;

    document.getElementById('tabBtnOverview').innerText = t.tabOverview;
    document.getElementById('tabBtnEconomics').innerText = t.tabEconomics;
    document.getElementById('tabBtnIspScada').innerText = t.tabIspScada;
    document.getElementById('tabBtnSurplus').innerText = t.tabSurplus;
    
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
    rawData.scadaHourly = json.scada_generation_hourly || [];
    rawData.henex = json.henex_indices || [];
    rawData.efficiency = json.thermal_efficiency || [];
    rawData.daily_surplus = json.daily_surplus || [];
    rawData.daily_gas_constraints = json.daily_gas_constraints || [];
    rawData.daily_economics = json.daily_economics || [];
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
async function loadStep(i, work) {          // βήματα 2…5: δουλειά → γέμισμα → ✓
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
        // Βήμα 1: πραγματική πρόοδος (2 αρχεία: meta + ιστορικό), με ελάχιστο χρόνο ανάγνωσης
        loadActivate(1);
        const t0 = Date.now();
        const files = [
            getJSON('data/meta.json', { cache: 'no-cache' }).catch((e) => { console.warn('meta.json δεν φορτώθηκε:', e); return null; }),   // όχι κρίσιμο
            getJSON(API_URL + '?v=' + Date.now())
        ];
        let done = 0;
        const [meta, json] = await Promise.all(files.map((p) => p.then((v) => { loadSet(1, Math.round(++done / files.length * 100)); return v; })));
        if (!json || !Array.isArray(json.isp_generation) || json.isp_generation.length === 0) throw new Error('historical.json is empty');
        applyData(json);
        applyMeta(meta);
        await pause(Math.max(0, LOAD_MIN_READ - (Date.now() - t0)));
        loadDone(1);
        await pause(LOAD_STEP);

        // Βήματα 2…5: ένα ανά tab, με τη σειρά των tabs
        if (typeof applyDataColors === 'function') applyDataColors();
        initExtraSelectors();
        paintTabs();
        await loadStep(2, async () => { updateOverviewTab(); });
        await loadStep(3, async () => { updateEconomicsTab(); });
        await loadStep(4, async () => { updateMonthlyTab(); });
        await loadStep(5, async () => { updateSurplusTab(); });
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
