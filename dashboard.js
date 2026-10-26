// ==========================================
// GLOBAL CHART INSTANCES & STATE
// ==========================================
let overviewChartInst = null;
let monthlyChartInst = null;
let surplusChartInst = null;

// ==========================================
// WATERFALL LOADING SEQUENCE (Με σωστούς χρόνους)
// ==========================================
// Η οθόνη φόρτωσης και η εκκίνηση είναι στο data.js (boot, D20): κάθε βήμα ζωγραφίζει πραγματικά ένα tab.

// ==========================================
// ΧΡΩΜΑΤΑ ΔΕΔΟΜΕΝΩΝ (D21)
// ==========================================
// Ένα χρώμα ανά οντότητα, ίδιο σε όλα τα tabs. Κανένα δεν είναι το accent (μπλε, D11) και το πράσινο μένει μόνο για
// «πλήρες / θετικό / ✓». Για να αλλάξει ένα χρώμα, αλλάζει ΕΔΩ και πουθενά αλλού.
const DATA_COLORS = {
    hgsida: '#d946ef',        // τιμή αερίου HGSIDA (KPI, γραμμή)
    srmc: '#fbbf24',          // SRMC στόλου (ίδιο με τις κλάσεις text-amber-400 των πινάκων και KPI)
    efficiency: '#e2e8f0',    // απόδοση στόλου: ουδέτερο, είναι σκέτο μέγεθος (ίδιο με text-slate-200)
    surplus: '#cbd5e1',       // residual surplus του ISP: ουδέτερο, είναι σκέτο μέγεθος
    constraints: '#f43f5e'    // παραγωγή constraint-driven
};
// Κλάσεις μονάδων: hex για τα γραφήματα και κλάσεις Tailwind για τις γραμμές του πίνακα (οι κλάσεις γράφονται
// ολόκληρες για να τις βρίσκει το Tailwind). Το «sticky» είναι το ίδιο χρώμα στο 10% πάνω στο φόντο της σελίδας.
const CLASS_STYLE = {
    1: { hex: '#06b6d4', row: 'bg-[#06b6d4]/10 hover:bg-[#06b6d4]/25', sticky: 'bg-[#0f273b]', text: 'text-[#06b6d4]' },   // H-Class (Super-Efficient)
    2: { hex: '#8b5cf6', row: 'bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/25', sticky: 'bg-[#1b1e3e]', text: 'text-[#8b5cf6]' },   // F-Class (Standard)
    3: { hex: '#f97316', row: 'bg-[#f97316]/10 hover:bg-[#f97316]/25', sticky: 'bg-[#272128]', text: 'text-[#f97316]' }    // Older Generation & Peakers
};
// Τα KPI που παίρνουν το χρώμα της οντότητάς τους από το DATA_COLORS (καλείται στην εκκίνηση)
function applyDataColors() {
    [['kpiHgsida', 'hgsida'], ['kpiFleetEff', 'efficiency'], ['kpiMonthSurplus', 'surplus']].forEach(([id, key]) => {
        const el = document.getElementById(id); if (el) el.style.color = DATA_COLORS[key];
    });
    // Τα τετράγωνα του υπομνήματος των κλάσεων (index.html) παίρνουν το χρώμα από το CLASS_STYLE
    document.querySelectorAll('[data-class-swatch]').forEach(el => { el.style.backgroundColor = CLASS_STYLE[el.dataset.classSwatch].hex; });
}

// ==========================================
// HELPERS
// ==========================================
function parseDate(dateObj) {
    if (!dateObj) return "";
    if (dateObj instanceof Date) return dateObj.toISOString().split('T')[0];
    return String(dateObj).split('T')[0].trim();
}

function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
    let n = parseFloat(str);
    return isNaN(n) ? 0 : n;
}

function formatEuro(amount) {
    return amount.toLocaleString('el-GR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getHourNumber(timeStr) {
    if (timeStr === undefined || timeStr === null || timeStr === "") return -1;
    let s = String(timeStr).trim();
    let parts = s.split(':');
    if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        return Math.round(h + m / 60);
    }
    return parseInt(s, 10) || -1;
}



function createDiagonalPattern(colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 8, 8);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(8, 0);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.lineTo(4, -4);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.lineTo(12, 4);
    ctx.stroke();
    
    return ctx.createPattern(canvas, 'repeat');
}

function getCanonicalUnitName(rawName) {
    if (!rawName) return "UNKNOWN";
    let clean = String(rawName).trim().toUpperCase();
    clean = clean.replace(/\s*\((ST\vert{}GT\d+)\)/gi, '').trim();

    if (clean === "KOMOTINI_POWER") return "KOMOTINI_POWER";
    if (clean.includes("KOMOTINI") || clean.includes("ΚΟΜΟΤΗΝΗ")) {
        if (clean.includes("POWER")) return "KOMOTINI_POWER";
        return "ΚΟΜΟΤΗΝΗ";
    }
    
    if (clean.includes("AG_NIKOLAOS") || clean.includes("ΑΓ. ΝΙΚΟΛΑΟΣ") || clean.includes("AGIOS NIKOLAOS")) return "AG_NIKOLAOS2";
    if (clean.includes("PROTERGIA")) return "PROTERGIA_CC";
    if (clean.includes("HERON") || clean.includes("ΘΗΣ ΗΡΩΝ") || clean.includes("ΗΡΩΝ")) return "ΘΗΣ ΗΡΩΝ";
    if (clean.includes("MEGALOPOLI") || clean.includes("ΜΕΓΑΛΟΠΟΛΗ")) return "ΜΕΓΑΛΟΠΟΛΗ 5";
    if (clean.includes("THISVI") || clean.includes("ΘΗΣΒ")) return "ELPEDISON_THISVI";
    if (clean.includes("ELPEDISON") && clean.includes("THIS")) return "ELPEDISON_THISVI";
    if (clean.includes("ELPEDISON") && clean.includes("THES")) return "ELPEDISON_THESS";
    if (clean.includes("KORINTHOS") || clean.includes("ΚΟΡΙΝΘΟΣ")) return "KORINTHOS_POWER";
    if (clean.includes("THESSALONIKI") || (clean.includes("THESS") && clean.includes("ELPEDISON"))) return "ELPEDISON_THESS";
    if (clean.includes("ALIVERI") || clean.includes("ΑΛΙΒΕΡΙ")) return "ΑΛΙΒΕΡΙ 5";
    if (clean.includes("LAVRIO 5") || clean.includes("ΛΑΥΡΙΟ 5") || clean.includes("LAVRIO5")) return "ΛΑΥΡΙΟ 5";
    if (clean.includes("LAVRIO 4") || clean.includes("ΛΑΥΡΙΟ 4") || clean.includes("LAVRIO4") || clean.includes("ΛΑΥΡΙΟ") || clean.includes("LAVRIOS")) return "ΛΑΥΡΙΟ 4";
    if (clean.includes("ALOUMINIO") || clean.includes("ΑΛΟΥΜΙΝΙΟ") || clean.includes("ALUM")) return "ΑΛΟΥΜΙΝΙΟ";

    return clean;
}

function getShortUnitName(canonicalName) {
    const map = {
        "AG_NIKOLAOS2": "AgNikol2",
        "KOMOTINI_POWER": "KomotPwr",
        "PROTERGIA_CC": "ProtergCc",
        "ΘΗΣ ΗΡΩΝ": "ThisHron",
        "ΑΛΙΒΕΡΙ 5": "Aliveri5",
        "KORINTHOS_POWER": "KorintPwr",
        "ELPEDISON_THISVI": "ElpedThisv",
        "ELPEDISON_THESS": "ElpedThess",
        "ΜΕΓΑΛΟΠΟΛΗ 5": "Megalop5",
        "ΛΑΥΡΙΟ 4": "Lavrio4",
        "ΛΑΥΡΙΟ 5": "Lavrio5",
        "ΚΟΜΟΤΗΝΗ": "Komotini",
        "ΑΛΟΥΜΙΝΙΟ": "Alouminio"
    };
    return map[canonicalName] || canonicalName;
}

function getUnitMetadata(unitName) {
    let result = { class: 'Older Generation & Peakers', eff: 0.50, order: 3 };
    if (!rawData || !rawData.efficiency) return result;

    const canonical = getCanonicalUnitName(unitName);
    const record = rawData.efficiency.find(r => {
        const sheetUnit = String(Object.values(r)[1]).trim().toUpperCase();
        return sheetUnit === canonical || sheetUnit === unitName.toUpperCase();
    });

    if (record) {
        const rawClass = Object.values(record)[0];
        result.class = rawClass;
        result.eff = parseNum(Object.values(record)[2]);
        if (rawClass.includes('Super-Efficient')) result.order = 1;
        else if (rawClass.includes('Standard')) result.order = 2;
        else result.order = 3;
    }
    
    if (result.order === 3) {
        result.class = (typeof currentLang !== 'undefined' && currentLang === 'el') 
            ? 'Παλαιότερη Γενιά & Peakers' 
            : 'Older Generation & Peakers';
    }

    return result;
}

// ==========================================
// TAB SWITCHING CONTROLLER
// ==========================================
// ==========================================
// ΚΕΛΥΦΟΣ: ΕΠΙΛΟΓΗ ΗΜΕΡΑΣ / ΜΗΝΑ, PILL, TABS (D22, όπως BESS D22–D24 και H06)
// ==========================================
// Ένα κουτί επιλογής: «Ημέρα» στα tabs Overview και Economics, «Μήνας» στα Monthly και Surplus. Το pill
// πληρότητας ανήκει στην επιλεγμένη ημέρα, γι' αυτό φαίνεται μόνο στα tabs με ημέρα, μέσα στο κουτί.
let currentTab = 'overview';
const TABS = {
    overview: ['tabBtnOverview', 'viewOverview'],
    economics: ['tabBtnEconomics', 'viewEconomics'],
    ispScada: ['tabBtnIspScada', 'viewIspScada'],
    surplus: ['tabBtnSurplus', 'viewSurplus']
};
const DAY_TABS = ['overview', 'economics'];
// Κινητό (< 768 px): κουμπιά 2 + 2 με ύψος 48 px· υπολογιστής: καρτέλες με γραμμή από κάτω. Στα 768–1023 px το
// κείμενο είναι μικρότερο και σπάει σε δύο γραμμές, γιατί το «Generic Constraints & Surplus» δεν χωράει σε 1/4 πλάτους.
const TAB_BASE = 'tab-btn flex items-center justify-center text-xs md:text-sm lg:text-base font-bold rounded-lg md:rounded-none min-h-12 py-1 w-full transition whitespace-normal leading-tight px-2 border md:border-0 md:border-b-2 cursor-pointer ';
const TAB_ON = 'bg-acc-400 text-slate-900 border-acc-400 md:bg-transparent md:text-acc-400 md:border-b-acc-400';
const TAB_OFF = 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white md:bg-transparent md:border-transparent md:hover:text-acc-200';

function paintTabs() {
    Object.entries(TABS).forEach(([key, [btn, view]]) => {
        const on = key === currentTab, b = document.getElementById(btn);
        b.className = TAB_BASE + (on ? TAB_ON : TAB_OFF);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        document.getElementById(view).classList.toggle('hidden', !on);
    });
}

function switchTab(tabId) {
    if (!TABS[tabId]) return;
    currentTab = tabId;
    paintTabs();
    updatePicker();
    if (tabId === 'overview') updateOverviewTab();
    if (tabId === 'economics') updateEconomicsTab();
    if (tabId === 'ispScada') updateMonthlyTab();
    if (tabId === 'surplus') updateSurplusTab();
    updateStatusBadge();
}

function todayAthens() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(new Date());   // YYYY-MM-DD
}
const isPhone = () => window.matchMedia('(max-width: 767px)').matches;

// Ημερομηνίες στη γλώσσα του επισκέπτη: «26 Οκτ 2026» / «26 Oct 2026»· στο κινητό χωρίς έτος όταν όλες είναι της ίδιας χρονιάς
function fmtDay(iso, noYear) {
    const [y, m, d] = iso.split('-').map(Number);
    const opts = { day: 'numeric', month: 'short', timeZone: 'UTC' };
    if (!noYear) opts.year = 'numeric';
    return new Intl.DateTimeFormat(i18n[currentLang].locale, opts).format(new Date(Date.UTC(y, m - 1, d)));
}
function fmtMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const s = new Intl.DateTimeFormat(i18n[currentLang].locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Ποιες ημέρες έχουν SCADA (σύνολο αερίου > 0), με ένα πέρασμα στα δεδομένα
function scadaCompleteness() {
    const tot = {}, units = {};
    (rawData.scada || []).forEach(r => {
        const v = Object.values(r), date = parseDate(v[0]), name = String(v[1]).trim(), val = parseNum(v[2]);
        if (name === 'TOTAL GAS UNITS' || name.includes('Σύνολο')) tot[date] = (tot[date] || 0) + val;
        else if (name !== 'NAN') units[date] = (units[date] || 0) + val;
    });
    return (date) => ((tot[date] || 0) > 0 ? tot[date] : (units[date] || 0)) > 0;
}

function fillPickers() {
    const dSel = document.getElementById('dateSelect'), mSel = document.getElementById('monthSelect');
    if (!dSel || !mSel || !rawData) return;
    const t = i18n[currentLang], today = todayAthens();
    const dates = [...new Set([...rawData.isp, ...rawData.scada].map(r => Object.values(r)[0]))].filter(x => x).sort().reverse();
    const complete = scadaCompleteness();
    const noYear = isPhone() && new Set(dates.map(x => x.substring(0, 4))).size === 1;

    const keepDay = dates.includes(dSel.value) ? dSel.value : null;
    dSel.innerHTML = '';
    dates.forEach(date => {
        const pending = !complete(date), opt = document.createElement('option');
        opt.value = date;
        opt.textContent = fmtDay(date, noYear) + (date === today ? ` (${t.today})` : '') + (pending ? ' ⚠' : '');
        opt.dataset.partial = pending ? 'true' : 'false';
        dSel.appendChild(opt);
    });
    // Πρώτη φορά: η πιο πρόσφατη ΠΛΗΡΗΣ ημέρα (αν η τελευταία περιμένει SCADA). Μετά κρατιέται η επιλογή του επισκέπτη.
    dSel.value = keepDay || dates.find(complete) || dates[0] || '';

    const months = [...new Set(dates.map(x => x.substring(0, 7)))];
    const keepMonth = months.includes(mSel.value) ? mSel.value : null;
    mSel.innerHTML = months.map(m => `<option value="${m}">${fmtMonth(m)}</option>`).join('');
    mSel.value = keepMonth || months[0] || '';
}

function updatePicker() {
    const t = i18n[currentLang], monthTab = !DAY_TABS.includes(currentTab);
    const label = document.getElementById('pickerLabel');
    if (label) { label.textContent = monthTab ? t.monthLabel : t.dateLabel; label.setAttribute('for', monthTab ? 'monthSelect' : 'dateSelect'); }
    const dSel = document.getElementById('dateSelect'), mSel = document.getElementById('monthSelect');
    if (dSel) dSel.classList.toggle('hidden', monthTab);
    if (mSel) mSel.classList.toggle('hidden', !monthTab);
}

// Αλλαγή επιλογής: ξαναζωγραφίζονται μόνο τα tabs που εξαρτώνται από αυτήν
function onDateChange() { updateOverviewTab(); updateEconomicsTab(); updateStatusBadge(); }
function onMonthChange() { updateMonthlyTab(); updateSurplusTab(); }

function updateStatusBadge() {
    const badge = document.getElementById('dataStatusBadge');
    if (!badge) return;
    const sel = document.getElementById('dateSelect'), opt = sel && sel.options[sel.selectedIndex];
    if (!DAY_TABS.includes(currentTab) || !opt) { badge.className = 'hidden'; return; }
    const t = i18n[currentLang], pending = opt.dataset.partial === 'true';
    // Πράσινο = πλήρες (D11)· πορτοκαλί = περιμένει το SCADA
    badge.className = 'flex shrink-0 items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] md:text-xs font-bold shadow-sm ' +
        (pending ? 'border-orange-500/30 bg-orange-500/10 text-orange-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400');
    badge.querySelector('div').className = 'w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ' + (pending ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500');
    document.getElementById('dataStatusTextShort').innerText = pending ? t.pillPendingShort : t.pillCompleteShort;
    document.getElementById('dataStatusTextLong').innerText = pending ? t.pillPending : t.pillComplete;
}

// Καλείται στην εκκίνηση και σε κάθε αλλαγή γλώσσας (μέσω updateDashboard): ξαναγράφει ημερομηνίες, ετικέτα και pill
function initExtraSelectors() {
    if (!rawData || !rawData.isp) return;
    fillPickers();
    updatePicker();
    updateStatusBadge();
}

// Όταν η οθόνη περνά το όριο των 768 px (π.χ. περιστροφή κινητού) αλλάζει η μορφή των ημερομηνιών (με ή χωρίς έτος)
window.matchMedia('(max-width: 767px)').addEventListener('change', () => { if (appReady) { fillPickers(); updatePicker(); updateStatusBadge(); } });

// ==========================================
// MASTER UPDATE TRIGGER
// ==========================================
function updateDashboard() {
    initExtraSelectors();
    updateOverviewTab();
    updateEconomicsTab();
    updateMonthlyTab();
    updateSurplusTab();
}

// ==========================================
// TAB 1: DAILY OVERVIEW
// ==========================================
function updateOverviewTab() {
    const dateSelect = document.getElementById('dateSelect');
    if (!dateSelect || !rawData || !rawData.isp) return;
    
    const selectedDate = dateSelect.value;
    if (!selectedDate) return;

    const ispDay = rawData.isp.filter(d => parseDate(Object.values(d)[0]) === selectedDate);
    const scadaDay = rawData.scada.filter(d => parseDate(Object.values(d)[0]) === selectedDate);

    let totalIsp = 0;
    let totalScada = 0;
    const unitMap = {};

    ispDay.forEach(d => {
        let uName = String(Object.values(d)[1]).trim();
        const val = parseNum(Object.values(d)[2]);
        if (uName === "TOTAL GAS UNITS") {
            totalIsp = val;
            return;
        }
        uName = getCanonicalUnitName(uName);
        if (!unitMap[uName]) unitMap[uName] = { name: uName, isp: 0, scada: 0, meta: getUnitMetadata(uName) };
        unitMap[uName].isp += val;
    });

    scadaDay.forEach(d => {
        let uName = String(Object.values(d)[1].trim());
        const val = parseNum(Object.values(d)[2]);
        if (uName === "TOTAL GAS UNITS") {
            totalScada = val;
            return;
        }
        uName = getCanonicalUnitName(uName);
        if (!unitMap[uName]) unitMap[uName] = { name: uName, isp: 0, scada: 0, meta: getUnitMetadata(uName) };
        unitMap[uName].scada += val;
    });

    const kpiIspEl = document.getElementById('kpiTotalIsp');
    const kpiScadaEl = document.getElementById('kpiTotalScada');
    if (kpiIspEl) kpiIspEl.innerText = totalIsp.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    if (kpiScadaEl) kpiScadaEl.innerText = totalScada.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});

    const unitsArray = Object.values(unitMap);
    unitsArray.sort((a, b) => {
        if (a.meta.order !== b.meta.order) return a.meta.order - b.meta.order;
        return b.scada - a.scada;
    });

    const labels = [];
    const classLabels = [];
    const dataIsp = [];
    const dataScada = [];
    const ispColors = [];
    const scadaColors = [];

    const colorMap = { 1: CLASS_STYLE[1].hex, 2: CLASS_STYLE[2].hex, 3: CLASS_STYLE[3].hex };

    unitsArray.forEach(u => {
        labels.push(getShortUnitName(u.name)); 
        classLabels.push(u.meta.class);
        dataIsp.push(u.isp);
        dataScada.push(u.scada);

        let baseColor = colorMap[u.meta.order] || '#64748b';
        ispColors.push(baseColor);
        scadaColors.push(createDiagonalPattern(baseColor));
    });

    renderOverviewChart(labels, classLabels, dataIsp, dataScada, ispColors, scadaColors);
}

function renderOverviewChart(labels, classLabels, dataIsp, dataScada, ispColors, scadaColors) {
    const canvas = document.getElementById('overviewChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (overviewChartInst) overviewChartInst.destroy();
    
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
    const labelIsp = (lang === 'el') ? 'Πρόγραμμα (ISP)' : 'Scheduled (ISP)';
    const labelScada = (lang === 'el') ? 'Πραγματικό (SCADA)' : 'Actual (SCADA)';

    overviewChartInst = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: labels, 
            datasets: [
                { 
                    label: labelIsp, 
                    data: dataIsp, 
                    backgroundColor: ispColors, 
                    borderRadius: 4,
                    barPercentage: 0.85,
                    categoryPercentage: 0.8
                }, 
                { 
                    label: labelScada, 
                    data: dataScada, 
                    backgroundColor: scadaColors, 
                    borderRadius: 4,
                    borderWidth: 1, 
                    borderColor: ispColors,
                    barPercentage: 0.85,
                    categoryPercentage: 0.8
                }
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false }, 
                tooltip: {
                    callbacks: {
                        beforeTitle: function(context) { return classLabels[context[0].dataIndex]; },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            label += context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ' MWh';
                            return label;
                        }
                    }
                }
            }, 
            scales: { 
                x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } }, 
                y: { 
                    grid: { color: '#334155' }, 
                    title: { display: true, text: 'MWh' },
                    ticks: {
                        callback: function(value) {
                            if (window.innerWidth < 640 && Math.abs(value) >= 1000) {
                                return (value / 1000) + 'k';
                            }
                            return value;
                        }
                    }
                } 
            } 
        } 
    });
}

// ==========================================
// TAB 2: DAILY ECONOMICS
// ==========================================
function updateEconomicsTab() {
    const dateSelect = document.getElementById('dateSelect');
    if (!dateSelect || !rawData) return;
    
    const selectedDate = dateSelect.value;
    if (!selectedDate) return;

    let dayEco = null;
    if (rawData.daily_economics) {
        dayEco = rawData.daily_economics.find(d => parseDate(d.Ημερομηνία) === selectedDate);
    }

    const tbody = document.getElementById('economicsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!dayEco || !dayEco.Units || dayEco.Units.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500">No economic data available for this date.</td></tr>`;
        document.getElementById('kpiHgsida').innerText = '-';
        document.getElementById('kpiCo2').innerText = '-';
        const co2BadgeEmpty = document.getElementById('kpiCo2Badge');
        if (co2BadgeEmpty) co2BadgeEmpty.style.display = 'none';
        document.getElementById('kpiFleetEff').innerText = '-';
        document.getElementById('kpiAvgGasCost').innerText = '-';
        document.getElementById('kpiEcoScada').innerText = '0';
        document.getElementById('kpiTotalEcoCost').innerText = '0 €';
        return;
    }

    const totals = dayEco["Fleet Totals"];
    const hgsidaVal = dayEco["HGSIDA (€/MWh)"] || 0;
    const co2PriceVal = dayEco["CO2 Price (€/t)"] || 0;

    document.getElementById('kpiHgsida').innerText = hgsidaVal.toFixed(2);
    const kpiCo2El = document.getElementById('kpiCo2');
    kpiCo2El.innerText = co2PriceVal > 0 ? co2PriceVal.toFixed(2) : '-';
    const co2Badge = document.getElementById('kpiCo2Badge');
    if (co2Badge) {
        const langCo2 = (typeof currentLang !== 'undefined') ? currentLang : 'en';
        co2Badge.innerText = langCo2 === 'el' ? 'εκτίμηση' : 'estimated';
        co2Badge.title = langCo2 === 'el'
            ? 'Δεν υπάρχει διαθέσιμη πραγματική τιμή CO2 για αυτή τη μέρα. Χρησιμοποιείται εκτίμηση.'
            : 'No real CO2 price is available for this day. An estimated value is used.';
        co2Badge.style.display = dayEco["CO2 Price Estimated"] ? 'inline' : 'none';
    }
    document.getElementById('kpiEcoScada').innerText = totals["Συνολική Παραγωγή (MWh)"].toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    document.getElementById('kpiAvgGasCost').innerText = totals["Μέσο SRMC Στόλου (€/MWh)"].toFixed(2);
    document.getElementById('kpiTotalEcoCost').innerText = formatEuro(totals["Συνολικό Κόστος Στόλου (€)"]);
    
    const totalMwh = totals["Συνολική Παραγωγή (MWh)"];
    const totalFuelCost = totals["Συνολικό Κόστος Καυσίμου (€)"];
    const avgFleetEff = (totalFuelCost > 0 && hgsidaVal > 0) ? (totalMwh * hgsidaVal / totalFuelCost) * 100 : 0;
    document.getElementById('kpiFleetEff').innerText = avgFleetEff > 0 ? avgFleetEff.toFixed(1) : '-';

    let sortedUnits = [...dayEco.Units];
    sortedUnits.sort((a, b) => {
        const orderA = getUnitMetadata(a["Μονάδα"]).order;
        const orderB = getUnitMetadata(b["Μονάδα"]).order;
        if (orderA !== orderB) return orderA - orderB;
        return b["Παραγωγή (MWh)"] - a["Παραγωγή (MWh)"];
    });

    sortedUnits.forEach(u => {
        const canonical = getCanonicalUnitName(u["Μονάδα"]);
        const shortName = getShortUnitName(canonical);
        const meta = getUnitMetadata(u["Μονάδα"]);

        const cs = CLASS_STYLE[meta.order] || CLASS_STYLE[3];
        const rowTint = cs.row, stickyTint = cs.sticky, classColor = cs.text;

        const unitFuelCost = u["Κόστος Καυσίμου (€)"];
        const unitEff = (unitFuelCost > 0 && hgsidaVal > 0) ? (u["Παραγωγή (MWh)"] * hgsidaVal / unitFuelCost) * 100 : 0;

        const MWh = u["Παραγωγή (MWh)"].toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        const Eff = unitEff > 0 ? unitEff.toFixed(1) + '%' : '-';
        const CO2 = u["Εκπομπές CO2 (t)"].toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' t';
        const SRMC = u["SRMC Μέσος Όρος (€/MWh)"].toFixed(2);
        const Cost = formatEuro(u["Συνολικό Κόστος (€)"]);

        const tr = document.createElement('tr');
        tr.className = `main-row ${rowTint} transition-all duration-300 cursor-pointer sm:cursor-default group`;
        tr.onclick = () => window.toggleMobileRow(tr);

        tr.innerHTML = `
            <td class="p-3 font-bold text-slate-200 sticky left-0 z-10 ${stickyTint} sm:bg-transparent shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] sm:shadow-none">
                <div class="flex justify-between items-center pr-1 sm:pr-0">
                    <span>${shortName}</span>
                    <svg class="w-4 h-4 text-slate-500 sm:hidden chevron transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </td>
            <td class="p-3 text-right font-mono">${MWh}</td>
            <td class="hidden sm:table-cell p-3 text-right font-mono" style="color:${DATA_COLORS.efficiency}">${Eff}</td>
            <td class="hidden sm:table-cell p-3 text-right font-mono text-slate-400">${CO2}</td>
            <td class="hidden sm:table-cell p-3 text-right font-mono text-amber-400">${SRMC}</td>
            <td class="p-3 text-right font-semibold text-slate-300">${Cost}</td>
        `;
        tbody.appendChild(tr);

        const trExpand = document.createElement('tr');
        trExpand.className = `expand-row hidden sm:hidden ${rowTint.split(' ')[0]} transition-all border-b-2 border-slate-800/80`;
        trExpand.innerHTML = `
            <td colspan="3" class="p-4 px-5">
                <ul class="space-y-3 text-sm">
                    <li class="flex justify-between items-center border-b border-slate-700/30 pb-2">
                        <span class="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Class</span>
                        <span class="${classColor} font-semibold text-xs">${meta.class}</span>
                    </li>
                    <li class="flex justify-between items-center border-b border-slate-700/30 pb-2">
                        <span class="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Efficiency</span>
                        <span class="font-mono font-bold" style="color:${DATA_COLORS.efficiency}">${Eff}</span>
                    </li>
                    <li class="flex justify-between items-center border-b border-slate-700/30 pb-2">
                        <span class="text-slate-400 uppercase tracking-wider text-[10px] font-bold">CO2 Emissions</span>
                        <span class="text-slate-300 font-mono">${CO2}</span>
                    </li>
                    <li class="flex justify-between items-center pb-1">
                        <span class="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Avg SRMC</span>
                        <span class="text-amber-400 font-mono font-bold">${SRMC} €/MWh</span>
                    </li>
                </ul>
            </td>
        `;
        tbody.appendChild(trExpand);
    });
}

window.toggleMobileRow = function(clickedRow) {
    if (window.innerWidth >= 640) return; 

    const expandRow = clickedRow.nextElementSibling;
    if (!expandRow || !expandRow.classList.contains('expand-row')) return;
    
    const isExpanded = !expandRow.classList.contains('hidden');
    
    const allMain = document.querySelectorAll('#economicsTableBody .main-row');
    const allExpand = document.querySelectorAll('#economicsTableBody .expand-row');
    
    allMain.forEach(r => {
        r.classList.remove('opacity-20');
        const chevron = r.querySelector('.chevron');
        if(chevron) chevron.style.transform = 'rotate(0deg)';
    });
    allExpand.forEach(r => r.classList.add('hidden'));

    if (!isExpanded) {
        expandRow.classList.remove('hidden');
        const chevron = clickedRow.querySelector('.chevron');
        if(chevron) chevron.style.transform = 'rotate(180deg)';
        
        allMain.forEach(r => {
            if (r !== clickedRow) r.classList.add('opacity-20');
        });
    }
};

// ==========================================
// TAB 3: MONTHLY ANALYTICS 
// ==========================================
function updateMonthlyTab() {
    const monthSelect = document.getElementById('monthSelect');
    if (!monthSelect || !rawData || !rawData.daily_economics) return;
    
    const selectedMonth = monthSelect.value; 
    if (!selectedMonth) return;

    const monthData = rawData.daily_economics
        .filter(d => parseDate(d.Ημερομηνία).startsWith(selectedMonth))
        .sort((a, b) => parseDate(a.Ημερομηνία).localeCompare(parseDate(b.Ημερομηνία)));

    const labels = [];
    const hgsidaData = [];
    const srmcData = [];
    const effData = [];

    let minCost = Infinity, minCostDay = '';
    let maxCost = -Infinity, maxCostDay = '';
    let minEff = Infinity, minEffDay = '';
    let maxEff = -Infinity, maxEffDay = '';

    monthData.forEach(day => {
        const dateStr = parseDate(day.Ημερομηνία);
        const dayNum = dateStr.split('-')[2];
        labels.push(dayNum);

        const hgsida = day["HGSIDA (€/MWh)"] || 0;
        const totals = day["Fleet Totals"];
        const srmc = totals["Μέσο SRMC Στόλου (€/MWh)"] || 0;
        
        const totalMwh = totals["Συνολική Παραγωγή (MWh)"];
        const totalFuelCost = totals["Συνολικό Κόστος Καυσίμου (€)"];
        const eff = (totalFuelCost > 0 && hgsida > 0) ? (totalMwh * hgsida / totalFuelCost) * 100 : 0;

        hgsidaData.push(hgsida);
        srmcData.push(srmc);
        effData.push(eff);

        if (srmc > 0 && srmc < minCost) { minCost = srmc; minCostDay = dayNum; }
        if (srmc > maxCost) { maxCost = srmc; maxCostDay = dayNum; }
        
        if (eff > 0 && eff < minEff) { minEff = eff; minEffDay = dayNum; }
        if (eff > maxEff) { maxEff = eff; maxEffDay = dayNum; }
    });

    document.getElementById('kpiPeakCost').innerText = maxCost !== -Infinity ? maxCost.toFixed(2) : '-';
    document.getElementById('kpiPeakCostDay').innerText = maxCostDay ? `Day ${maxCostDay}` : '';
    
    document.getElementById('kpiBestCost').innerText = minCost !== Infinity ? minCost.toFixed(2) : '-';
    document.getElementById('kpiBestCostDay').innerText = minCostDay ? `Day ${minCostDay}` : '';
    
    document.getElementById('kpiWorstEff').innerText = minEff !== Infinity ? minEff.toFixed(1) : '-';
    document.getElementById('kpiWorstEffDay').innerText = minEffDay ? `Day ${minEffDay}` : '';
    
    document.getElementById('kpiMaxEff').innerText = maxEff !== -Infinity ? maxEff.toFixed(1) : '-';
    document.getElementById('kpiMaxEffDay').innerText = maxEffDay ? `Day ${maxEffDay}` : '';

    renderMonthlyChart(labels, hgsidaData, srmcData, effData);
}

function renderMonthlyChart(labels, hgsidaData, srmcData, effData) {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (monthlyChartInst) monthlyChartInst.destroy();
    
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    monthlyChartInst = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels: labels, 
            datasets: [
                { 
                    label: 'HGSIDA Gas Price', 
                    data: hgsidaData, 
                    borderColor: DATA_COLORS.hgsida, 
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: DATA_COLORS.hgsida,
                    yAxisID: 'y'
                },
                { 
                    label: 'Avg Fleet SRMC', 
                    data: srmcData, 
                    borderColor: DATA_COLORS.srmc, 
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    fill: true,
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: DATA_COLORS.srmc,
                    yAxisID: 'y'
                },
                {
                    label: 'Fleet Efficiency',
                    data: effData,
                    borderColor: DATA_COLORS.efficiency, 
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5], 
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: DATA_COLORS.efficiency,
                    yAxisID: 'y2' 
                }
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: true, position: 'top', labels: { boxWidth: 15, font: { size: 12 }, usePointStyle: true } }, 
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label = label + ': ';
                            if (context.dataset.yAxisID === 'y2') {
                                label += context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' %';
                            } else {
                                label += context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €/MWh';
                            }
                            return label;
                        }
                    }
                }
            }, 
            scales: { 
                x: { grid: { color: '#1e293b' }, title: { display: true, text: 'Day of Month', color: '#64748b' } }, 
                y: { 
                    type: 'linear', 
                    display: true, 
                    position: 'left', 
                    grid: { color: '#334155' }, 
                    title: { display: true, text: 'Cost (€ / MWh)' },
                    min: 0
                },
                y2: { 
                    type: 'linear', 
                    display: true, 
                    position: 'right', 
                    min: 40, 
                    max: 60, 
                    grid: { drawOnChartArea: false }, 
                    title: { display: true, text: 'Efficiency (%)' } 
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        } 
    });
}

// ==========================================
// TAB 4: SYSTEM NEEDS (SURPLUS & CONSTRAINTS)
// ==========================================
function getScadaReadyDays() {
    const totals = {}, unitSums = {};
    (rawData && rawData.scada ? rawData.scada : []).forEach(d => {
        const vals = Object.values(d);
        const day = parseDate(vals[0]);
        const uName = String(vals[1]).trim();
        const v = parseNum(vals[2]);
        if (uName === "TOTAL GAS UNITS" || uName.includes("Σύνολο")) {
            totals[day] = (totals[day] || 0) + v;
        } else if (uName !== "NAN") {
            unitSums[day] = (unitSums[day] || 0) + v;
        }
    });
    const ready = new Set();
    new Set([...Object.keys(totals), ...Object.keys(unitSums)]).forEach(day => {
        if ((totals[day] || 0) > 0 || (unitSums[day] || 0) > 0) ready.add(day);
    });
    return ready;
}

function updateSurplusTab() {
    const monthSelect = document.getElementById('monthSelect');
    if (!monthSelect || !rawData || !rawData.daily_surplus || !rawData.daily_gas_constraints || !rawData.scadaHourly) return;
    
    const selectedMonth = monthSelect.value;
    if (!selectedMonth) return;

    let constraintsByDay = {};
    
    rawData.daily_gas_constraints.forEach(c => {
        let vals = Object.values(c);
        let d = parseDate(vals[0]); 
        if (!d.startsWith(selectedMonth)) return;
        
        let unit = getCanonicalUnitName(vals[1]); 
        
        let hFromParts = String(vals[2] || "").trim().split(':');
        let hToParts = String(vals[3] || "").trim().split(':');
        
        let hFromInt = parseInt(hFromParts[0], 10) || 0;
        let hToInt = parseInt(hToParts[0], 10) || 0;
        
        let hStart = hFromInt + 1; 
        let hEnd = hToInt;         
        
        if (hStart <= hEnd) {
            if (!constraintsByDay[d]) constraintsByDay[d] = {};
            if (!constraintsByDay[d][unit]) {
                constraintsByDay[d][unit] = { hStart: hStart, hEnd: hEnd };
            } else {
                constraintsByDay[d][unit].hStart = Math.min(constraintsByDay[d][unit].hStart, hStart);
                constraintsByDay[d][unit].hEnd = Math.max(constraintsByDay[d][unit].hEnd, hEnd);
            }
        }
    });

    const scadaCanonNames = new Set(rawData.scadaHourly.map(r => getCanonicalUnitName(String(Object.values(r)[1]).trim())));
    const warnedUnits = new Set();
    Object.values(constraintsByDay).forEach(units => {
        Object.keys(units).forEach(u => {
            if (!scadaCanonNames.has(u) && !warnedUnits.has(u)) {
                warnedUnits.add(u);
                console.warn(`[Constraints] Η μονάδα "${u}" δεν ταιριάζει με καμία μονάδα SCADA — τα MWh της δεν προσμετρώνται.`);
            }
        });
    });

    let dailyConstrainedMwh = {};
    
    rawData.scadaHourly.forEach(row => {
        let vals = Object.values(row);
        let d = parseDate(vals[0]); 
        if (!d.startsWith(selectedMonth)) return;
        if (!constraintsByDay[d]) return; 
        
        let rawUnit = String(vals[1] || "").trim(); 
        if (rawUnit === "TOTAL GAS UNITS" || rawUnit.includes("Σύνολο") || rawUnit === "NAN") return;
        
        let cUnit = getCanonicalUnitName(rawUnit);
        
        if (constraintsByDay[d][cUnit]) {
            if (!dailyConstrainedMwh[d]) dailyConstrainedMwh[d] = 0;
            
            let window = constraintsByDay[d][cUnit];
            
            for (let h = window.hStart; h <= window.hEnd; h++) {
                if (h >= 1 && h <= 24) {
                    // Η ώρα διαβάζεται με το ΟΝΟΜΑ της ("05:00"), όχι με τη θέση της στη γραμμή: σε μέρα 23 ωρών η θέση
                    // της ώρας 24 θα ήταν το «Ημερήσιο Σύνολο» και θα προσμετρούνταν ως ώρα (D17). Ώρα που δεν υπάρχει = 0.
                    let val = parseNum(row[String(h).padStart(2, '0') + ':00']);
                    dailyConstrainedMwh[d] += val;
                }
            }
        }
    });

    let dailySurplusMap = {};
    rawData.daily_surplus.forEach(row => {
        let vals = Object.values(row);
        let d = parseDate(vals[0]); 
        if (d.startsWith(selectedMonth)) {
            let val = parseNum(vals[1]); 
            dailySurplusMap[d] = val;
        }
    });

    const readyDays = getScadaReadyDays();
    const allDatesInMonth = [...new Set([...Object.keys(dailyConstrainedMwh), ...Object.keys(dailySurplusMap)])]
        .filter(day => readyDays.has(day))
        .sort();
    
    const labels = [];
    const surplusData = [];
    const constraintsData = [];
    let sumSurplus = 0;
    let sumConstraints = 0;

    allDatesInMonth.forEach(day => {
        labels.push(day.split('-')[2]); 
        
        let s = Math.abs(dailySurplusMap[day] || 0); 
        let c = dailyConstrainedMwh[day] || 0;
        
        surplusData.push(s);
        constraintsData.push(c);
        
        sumSurplus += s;
        sumConstraints += c;
    });

    document.getElementById('kpiMonthSurplus').innerText = sumSurplus.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    document.getElementById('kpiMonthConstraints').innerText = sumConstraints.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});

    renderSurplusChart(labels, surplusData, constraintsData);
}

function renderSurplusChart(labels, surplusData, constraintsData) {
    const canvas = document.getElementById('surplusChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (surplusChartInst) surplusChartInst.destroy();
    
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    surplusChartInst = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: labels, 
            datasets: [
                { 
                    label: 'Residual Energy Surplus', 
                    data: surplusData, 
                    backgroundColor: DATA_COLORS.surplus, 
                    borderRadius: 4
                }, 
                { 
                    label: 'Generic Constraints (Out of Merit)', 
                    data: constraintsData, 
                    backgroundColor: DATA_COLORS.constraints, 
                    borderRadius: 4
                }
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 15, font: { size: 12 } } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            label += context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ' MWh';
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, title: { display: true, text: 'Day of Month', color: '#64748b' } },
                y: { 
                    grid: { color: '#334155' }, 
                    title: { display: true, text: 'MWh' },
                    ticks: {
                        callback: function(value) {
                            if (window.innerWidth < 640 && Math.abs(value) >= 1000) {
                                return (value / 1000) + 'k';
                            }
                            return value;
                        }
                    }
                }
            }
        } 
    });
}
