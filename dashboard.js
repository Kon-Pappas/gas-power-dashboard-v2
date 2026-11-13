// ==========================================
// GLOBAL CHART INSTANCES & STATE
// ==========================================
let overviewChartInst = null;
let monthlyChartInst = null;
let surplusChartInst = null;
// D37: η Ανασκόπηση ημέρας φορτώνει το data/review.json ΜΟΝΟ όταν ανοίξει το tab (idle → loading → ready | error)
let reviewData = null, reviewState = 'idle', reviewBase = 'prev', reviewShowAll = false;

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
    return fmtN(amount, 0) + '\u00a0€';
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



// ==========================================
// ΓΡΑΦΗΜΑΤΑ: αριθμοί και tooltips (D26, όπως BESS D38–D41, Flows και live)
// ==========================================
// Τιμή που λείπει (δεν έφτασαν τα δεδομένα) γράφεται «–», ποτέ «0» ούτε «-» (D27, όπως BESS D50)
const DASH = '–';
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Όλοι οι αριθμοί της σελίδας στη μορφή της γλώσσας (αγγλικά 74,911.5 · ελληνικά 74.911,5), με το σωστό «−» και «–» όταν λείπει η τιμή
function fmtN(v, dec = 0, signed = false) {
    if (v === null || v === undefined || Number.isNaN(v)) return '–';
    return new Intl.NumberFormat(i18n[currentLang].locale, { minimumFractionDigits: dec, maximumFractionDigits: dec, signDisplay: signed ? 'exceptZero' : 'auto' })
        .format(v).replace('-', '−');
}
const roundsToZero = (v, dec = 0) => v === null || v === undefined || Math.abs(v) < 0.5 * Math.pow(10, -dec);

// Δικό μας HTML tooltip (ίδιο με BESS, Flows και live): μένει πάντα μέσα στην οθόνη
function htmlTip(build) {
    return (ctx) => {
        let el = document.getElementById('chart-tip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'chart-tip';
            el.className = 'fixed z-[9000] pointer-events-none rounded-lg border border-slate-600 bg-slate-900/95 shadow-2xl px-4 py-3 min-w-[240px] max-w-[92vw] transition-opacity duration-150';
            el.style.opacity = 0;
            document.body.appendChild(el);
        }
        const tt = ctx.tooltip;
        if (!tt || tt.opacity === 0 || !tt.dataPoints || !tt.dataPoints.length) { el.style.opacity = 0; return; }
        const html = build(tt.dataPoints[0].dataIndex);
        if (!html) { el.style.opacity = 0; return; }
        el.innerHTML = html;
        el.style.opacity = 1;
        const r = ctx.chart.canvas.getBoundingClientRect();
        const w = el.offsetWidth, h = el.offsetHeight, gap = 14;
        let x = r.left + tt.caretX + gap;
        if (x + w > window.innerWidth - 8) x = r.left + tt.caretX - w - gap;
        x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
        let y = r.top + (ctx.chart.chartArea ? ctx.chart.chartArea.top : 0);
        y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
        el.style.left = `${x}px`; el.style.top = `${y}px`;
    };
}
const tipOff = (build) => ({ enabled: false, external: htmlTip(build) });
function hideChartTip() { const el = document.getElementById('chart-tip'); if (el) el.style.opacity = 0; }
window.addEventListener('scroll', hideChartTip, { passive: true });

const tipHead = (left, right = '') => `<div class="flex justify-between items-baseline gap-6 mb-2.5"><span class="text-acc-400 font-bold text-sm">${escapeHtml(left)}</span><span class="text-xs font-bold text-slate-300">${escapeHtml(right)}</span></div>`;
const tipRule = '<div class="border-t border-dashed border-white/20 my-2"></div>';
function tipRow(label, value, color, opts = {}) {
    const sw = color ? `<span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:${color}"></span>` : '';
    const unit = opts.unit === false ? '' : ` <span class="text-[11px] font-normal text-slate-500">${escapeHtml(opts.unit || 'MWh')}</span>`;
    return `<div class="grid grid-cols-[1fr_auto] gap-4 py-0.5 text-slate-300 text-[13px]">` +
        `<span class="flex items-center gap-2 min-w-0">${sw}<span class="leading-tight">${escapeHtml(label)}</span></span>` +
        `<span class="text-right text-slate-100" style="font-variant-numeric:tabular-nums">${value}${unit}</span></div>`;
}
const tipNote = (text) => `<div class="text-[11px] text-slate-400 mt-1.5">${escapeHtml(text)}</div>`;

// Κοινές ρυθμίσεις όλων των γραφημάτων (μία φορά ανά σχεδίαση), αριθμοί των αξόνων στη γλώσσα της σελίδας
function applyChartDefaults() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.locale = i18n[currentLang].locale;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
    Chart.defaults.animation.duration = (typeof REDUCE_MOTION !== 'undefined' && REDUCE_MOTION) ? 0 : 400;
}
// Σε κινητό οι χιλιάδες γράφονται «5k» στον κάθετο άξονα: κερδίζουμε οριζόντιο χώρο
function axisTick(v, idx, ticks) {
    if (isPhone()) {
        if (Math.abs(v) >= 1000) { const k = v / 1000; return fmtN(k, Number.isInteger(k) ? 0 : 1) + 'k'; }
        return fmtN(v, Number.isInteger(v) ? 0 : 1);
    }
    return Chart.Ticks.formatters.numeric.call(this, v, idx, ticks);
}
const yTicks = { callback: axisTick };
// Στο κινητό δείχνουμε ΟΛΕΣ τις μονάδες στον οριζόντιο άξονα, κάθετες και μικρότερες· αλλιώς το Chart.js παραλείπει τις μισές
const unitXTicks = () => isPhone() ? { autoSkip: false, maxRotation: 90, minRotation: 90, font: { size: 10 } } : { maxRotation: 45, minRotation: 45 };

// ---- Daily overview: μία μονάδα, πρόγραμμα (ISP) έναντι πραγματικού (SCADA)
function unitTip(unit, cls, isp, sc, color) {
    const T = i18n[currentLang], sel = document.getElementById('dateSelect');
    const opt = sel && sel.options[sel.selectedIndex], pending = !!opt && opt.dataset.partial === 'true';
    let html = tipHead(unit, sel && sel.value ? fmtDay(sel.value) : '');
    if (cls) html += `<div class="text-[11px] text-slate-400 -mt-1.5 mb-2">${escapeHtml(cls)}</div>`;
    if (roundsToZero(isp) && roundsToZero(sc)) return html + tipNote(pending ? T.tipScadaPending : T.tipNoMove);
    const striped = `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px 4px)`;
    if (!roundsToZero(isp)) html += tipRow(T.legIsp, fmtN(isp), color);
    if (!roundsToZero(sc)) html += tipRow(T.legScada, fmtN(sc), striped);
    if (roundsToZero(sc) && pending) return html + tipNote(T.tipScadaPending);
    const dev = (sc || 0) - (isp || 0);
    if (!roundsToZero(sc) && !roundsToZero(dev)) html += tipRule + tipRow(T.tipDev, fmtN(dev, 0, true), null);
    return html;
}
// ---- Monthly analytics: μία ημέρα, τρία μεγέθη (τα κενά της ημέρας είναι null)
function monthlyTip(i, dates, hgsida, srmc, eff) {
    const T = i18n[currentLang];
    let html = tipHead(fmtDay(dates[i]));
    if (hgsida[i] === null || hgsida[i] === undefined) return html + tipNote(T.tipNoData);
    if (!roundsToZero(hgsida[i], 2)) html += tipRow(T.legHgsida, fmtN(hgsida[i], 2), DATA_COLORS.hgsida, { unit: '€/MWh' });
    if (!roundsToZero(srmc[i], 2)) html += tipRow(T.legSrmc, fmtN(srmc[i], 2), DATA_COLORS.srmc, { unit: '€/MWh' });
    if (!roundsToZero(eff[i], 1)) html += tipRow(T.legEff, fmtN(eff[i], 1), DATA_COLORS.efficiency, { unit: '%' });
    return html;
}
// ---- Generic constraints & surplus: μία ημέρα, δύο μεγέθη
function surplusTip(i, dates, surplus, constraints) {
    const T = i18n[currentLang];
    let html = tipHead(fmtDay(dates[i]));
    if (surplus[i] === null || surplus[i] === undefined) return html + tipNote(T.tipNoData);
    if (roundsToZero(surplus[i]) && roundsToZero(constraints[i])) return html + tipNote(T.tipNoSurplus);
    if (!roundsToZero(surplus[i])) html += tipRow(T.legSurplus, fmtN(surplus[i]), DATA_COLORS.surplus);
    if (!roundsToZero(constraints[i])) html += tipRow(T.legConstraints, fmtN(constraints[i]), DATA_COLORS.constraints);
    return html;
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
        result.class = i18n[currentLang].lgdOlder;   // το ίδιο όνομα με το υπόμνημα του γραφήματος (D26)
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
    surplus: ['tabBtnSurplus', 'viewSurplus'],
    review: ['tabBtnReview', 'viewReview']
};
const DAY_TABS = ['overview', 'economics', 'review'];
// Κινητό (< 768 px): κουμπιά 2 + 2 με ύψος 48 px· υπολογιστής: καρτέλες με γραμμή από κάτω. Στα 768–1023 px το
// κείμενο είναι μικρότερο και σπάει σε δύο γραμμές, γιατί το «Generic Constraints & Surplus» δεν χωράει σε 1/4 πλάτους.
const TAB_BASE = 'tab-btn flex items-center justify-center text-xs md:text-xs lg:text-base font-bold rounded-lg md:rounded-none min-h-12 py-1 w-full transition whitespace-normal leading-tight px-2 border md:border-0 md:border-b-2 cursor-pointer ';
const TAB_ON = 'bg-acc-400 text-slate-900 border-acc-400 md:bg-transparent md:text-acc-400 md:border-b-acc-400';
const TAB_OFF = 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white md:bg-transparent md:border-transparent md:hover:text-acc-200';

// Κινητό: 3 + 2 (πλέγμα 6 στηλών)· από 768 px πέντε ίσες στήλες (D41)
const TAB_SPAN = { overview: ' col-span-2 md:col-span-1', economics: ' col-span-2 md:col-span-1', ispScada: ' col-span-2 md:col-span-1', surplus: ' col-span-3 md:col-span-1', review: ' col-span-3 md:col-span-1' };
function paintTabs() {
    Object.entries(TABS).forEach(([key, [btn, view]]) => {
        const on = key === currentTab, b = document.getElementById(btn);
        b.className = TAB_BASE + (on ? TAB_ON : TAB_OFF) + TAB_SPAN[key];   // κινητό: πλέγμα 6 στηλών, τρία tabs με 2 στήλες και δύο με 3 (3 + 2)
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        document.getElementById(view).classList.toggle('hidden', !on);
    });
}

function switchTab(tabId) {
    if (!TABS[tabId]) return;
    currentTab = tabId;
    hideChartTip();
    paintTabs();
    updatePicker();
    if (tabId === 'overview') updateOverviewTab();
    if (tabId === 'economics') updateEconomicsTab();
    if (reviewState === 'error' && ['ispScada', 'surplus', 'review'].includes(tabId)) reviewState = 'idle';   // νέα προσπάθεια αν απέτυχε πριν
    if (tabId === 'ispScada') updateMonthlyTab();
    if (tabId === 'surplus') updateSurplusTab();
    if (tabId === 'review') updateReviewTab();
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

// D46 (K37): η κατάσταση της ημέρας την υπολογίζει το Python (day_status)· η σελίδα μόνο την εμφανίζει
function dayStatusOf(day) { return (rawData && rawData.dayStatus && rawData.dayStatus[day]) || null; }

// ΕΦΕΔΡΙΚΟΣ υπολογισμός (μόνο όταν το αρχείο δεν έχει ακόμα day_status· θα φύγει στο επόμενο batch): ποιες ημέρες έχουν SCADA (σύνολο αερίου > 0)
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
    const complete0 = scadaCompleteness();
    const complete = (d) => { const s = dayStatusOf(d); return s ? !!s.scada_complete : complete0(d); };
    const noYear = isPhone() && new Set(dates.map(x => x.substring(0, 4))).size === 1;

    const keepDay = dates.includes(dSel.value) ? dSel.value : null;
    dSel.innerHTML = '';
    dates.forEach(date => {
        const pending = !complete(date), opt = document.createElement('option');
        opt.value = date;
        // Στο κινητό το «(σήμερα)» δεν χωράει στο πεδίο (στα ελληνικά κόβεται): το ⚠ λέει ήδη ότι η ημέρα περιμένει (K27)
        opt.textContent = fmtDay(date, noYear) + (date === today && !isPhone() ? ` (${t.today})` : '') + (pending ? ' ⚠' : '');
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
function onDateChange() { updateOverviewTab(); updateEconomicsTab(); updateReviewTab(); updateStatusBadge(); }
function onMonthChange() { updateMonthlyTab(); updateSurplusTab(); }

function updateStatusBadge() {
    const badge = document.getElementById('dataStatusBadge');
    if (!badge) return;
    const sel = document.getElementById('dateSelect'), opt = sel && sel.options[sel.selectedIndex];
    if (!DAY_TABS.includes(currentTab) || !opt) { badge.className = 'hidden'; return; }
    const t = i18n[currentLang];
    // Πράσινο = πλήρες (D11)· πορτοκαλί = περιμένει το SCADA· D39: στα tabs Οικονομικά και Ανασκόπηση, αν η ημέρα δεν έχει οικονομικά,
    // γαλάζιο = αναμονή HGSIDA (η ημέρα είναι από τις τελευταίες 3) ή γκρι = χωρίς οικονομικά (παλαιότερη ημέρα)
    const ds = dayStatusOf(sel.value);
    let state;
    if (ds) {   // D46: το Python αποφασίζει· στην Επισκόπηση μετράει μόνο το SCADA, στα Οικονομικά και στην Ανασκόπηση και τα οικονομικά
        state = !ds.scada_complete ? 'pending' : ((currentTab === 'economics' || currentTab === 'review') ? ({ complete: 'complete', waiting_hgsida: 'hgsida', no_economics: 'noeco', pending_scada: 'pending' }[ds.state] || 'complete') : 'complete');
    } else {    // εφεδρικός υπολογισμός (παλιό αρχείο χωρίς day_status)
        state = opt.dataset.partial === 'true' ? 'pending' : 'complete';
        if (state === 'complete' && (currentTab === 'economics' || currentTab === 'review') && rawData && rawData.daily_economics) {
            if (!rawData.daily_economics.some(e => parseDate(e.Ημερομηνία) === sel.value)) {
                const latest = Array.from(sel.options).map(o => o.value).sort().pop();
                state = (new Date(latest + 'T00:00:00Z') - new Date(sel.value + 'T00:00:00Z')) / 86400000 <= 2 ? 'hgsida' : 'noeco';
            }
        }
    }
    const STYLE = {
        complete: ['border-emerald-500/30 bg-emerald-500/10 text-emerald-400', 'bg-emerald-500', t.pillCompleteShort, t.pillComplete],
        pending: ['border-orange-500/30 bg-orange-500/10 text-orange-400', 'bg-orange-500 animate-pulse', t.pillPendingShort, t.pillPending],
        hgsida: ['border-sky-500/30 bg-sky-500/10 text-sky-300', 'bg-sky-400 animate-pulse', t.pillHgsidaShort, t.pillHgsida],
        noeco: ['border-slate-600/40 bg-slate-700/30 text-slate-300', 'bg-slate-400', t.pillNoEcoShort, t.pillNoEco]
    }[state];
    badge.className = 'flex shrink-0 items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] md:text-xs font-bold shadow-sm ' + STYLE[0];
    badge.querySelector('div').className = 'w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ' + STYLE[1];
    document.getElementById('dataStatusTextShort').innerText = STYLE[2];
    document.getElementById('dataStatusTextLong').innerText = STYLE[3];
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
    updateReviewTab();
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
    if (kpiIspEl) kpiIspEl.innerText = ispDay.length ? fmtN(totalIsp, 0) : DASH;
    if (kpiScadaEl) kpiScadaEl.innerText = scadaDay.length ? fmtN(totalScada, 0) : DASH;
    const lgI = document.getElementById('lgTotalIsp'), lgS = document.getElementById('lgTotalScada');   // D44: τα ίδια σύνολα μέσα στο υπόμνημα (από 768 px)
    if (lgI) lgI.innerText = ispDay.length ? fmtN(totalIsp, 0) : DASH;
    if (lgS) lgS.innerText = scadaDay.length ? fmtN(totalScada, 0) : DASH;

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
    hideChartTip();
    applyChartDefaults();
    const T = i18n[currentLang];

    overviewChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: T.legIsp,
                    data: dataIsp,
                    backgroundColor: ispColors,
                    borderRadius: 4,
                    barPercentage: 0.85,
                    categoryPercentage: 0.8
                },
                {
                    label: T.legScada,
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
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: tipOff(i => unitTip(labels[i], classLabels[i], dataIsp[i], dataScada[i], ispColors[i]))
            },
            scales: {
                x: { grid: { display: false }, ticks: unitXTicks() },
                y: { grid: { color: '#334155' }, title: { display: true, text: 'MWh' }, ticks: yTicks }
            }
        }
    });
}

// ==========================================
// TAB 2: DAILY ECONOMICS
// ==========================================
// D44/D46: ημέρα χωρίς οικονομικά: το μήνυμα λέει ΠΟΙΟ δεδομένο λείπει και το κουμπί γυρίζει στην τελευταία ημέρα με οικονομικά (Οικονομικά και Ανασκόπηση)
function dayMissingKind(day) {
    const ds = dayStatusOf(day);
    if (ds) {   // D46: από το Python, με ΜΙΑ ημέρα αναφοράς (η τελευταία ημέρα δεδομένων), όπως το pill
        if (ds.state === 'no_economics') return 'Old';
        return !ds.scada_complete && !ds.hgsida ? 'Both' : (!ds.scada_complete ? 'Scada' : (!ds.hgsida ? 'Hgsida' : 'Calc'));
    }
    const opt = Array.from(document.getElementById('dateSelect').options).find(o => o.value === day);
    const eco = (rawData.daily_economics || []).map(e => parseDate(e.Ημερομηνία)).sort();
    const latest = eco.length ? eco[eco.length - 1] : null;
    if (latest && (new Date(latest + 'T00:00:00Z') - new Date(day + 'T00:00:00Z')) / 86400000 > 2) return 'Old';   // παλαιότερη ημέρα: δεν υπάρχουν οικονομικά στο ιστορικό
    const scadaOk = !(opt && opt.dataset.partial === 'true');                                                       // ίδιος κανόνας με το pill (D44: στο batch 28 περνά στο Python)
    const he = (rawData.henex || []).find(r => parseDate(Object.values(r)[0]) === day);
    const hgOk = !!(he && Number(he['HGSIDA (€/MWh)']) > 0);
    return !scadaOk && !hgOk ? 'Both' : (!scadaOk ? 'Scada' : (!hgOk ? 'Hgsida' : 'Calc'));
}
function latestEcoDay(day) {
    const sel = document.getElementById('dateSelect'), eco = {};
    (rawData.daily_economics || []).forEach(e => { eco[parseDate(e.Ημερομηνία)] = e; });
    return Object.keys(eco).filter(d => eco[d].Units && eco[d].Units.length && Array.from(sel.options).some(o => o.value === d)).sort().pop() || null;
}
function showMissing(msgId, bodyId, text, go) {
    const msg = document.getElementById(msgId), body = document.getElementById(bodyId);
    msg.textContent = text;
    if (go) {
        const wrap = document.createElement('div'), b = document.createElement('button');
        wrap.className = 'mt-4'; b.type = 'button'; b.textContent = go.label;
        b.className = 'px-4 py-2 rounded-full text-xs font-semibold border border-acc-400 bg-acc-400 text-slate-900 hover:bg-acc-300 transition';
        b.onclick = () => { document.getElementById('dateSelect').value = go.day; onDateChange(); };
        wrap.appendChild(b); msg.appendChild(wrap);
    }
    msg.classList.remove('hidden'); body.classList.add('hidden');
}
function hideMissing(msgId, bodyId) { document.getElementById(msgId).classList.add('hidden'); document.getElementById(bodyId).classList.remove('hidden'); }

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
    const cards = document.getElementById('economicsCards');   // κάτω από 768 px ο πίνακας γίνεται κάρτες (D27)
    if (cards) { cards.innerHTML = ''; cards.setAttribute('aria-label', i18n[currentLang].ttlEcoTable); }

    if (!dayEco || !dayEco.Units || dayEco.Units.length === 0) {
        const t = i18n[currentLang], latest = latestEcoDay(selectedDate);
        showMissing('ecoMsg', 'ecoBody', t['ecoMiss' + dayMissingKind(selectedDate)], latest && latest !== selectedDate ? { day: latest, label: t.revGoLatest.replace('{date}', fmtDay(latest, true)) } : null);
        return;
    }
    hideMissing('ecoMsg', 'ecoBody');

    const totals = dayEco["Fleet Totals"];
    const hgsidaVal = dayEco["HGSIDA (€/MWh)"] || 0;

    document.getElementById('kpiHgsida').innerText = fmtN(hgsidaVal, 2);
    // D35: η ΤΙΜΗ CO2 δεν εμφανίζεται (K33)· η κάρτα δείχνει τις εκπομπές του στόλου, που τις υπολογίζουμε εμείς
    const co2Tons = totals["Συνολικοί Τόνοι CO2 (t)"];
    document.getElementById('kpiCo2Tons').innerText = (typeof co2Tons === 'number' && co2Tons > 0) ? fmtN(co2Tons, 0) : DASH;
    document.getElementById('kpiEcoScada').innerText = fmtN(totals["Συνολική Παραγωγή (MWh)"], 0);
    document.getElementById('kpiAvgGasCost').innerText = fmtN(totals["Μέσο SRMC Στόλου (€/MWh)"], 2);
    document.getElementById('kpiTotalEcoCost').innerText = fmtN(totals["Συνολικό Κόστος Στόλου (€)"], 0);   // το € είναι ήδη στο HTML δίπλα στο νούμερο
    
    const totalMwh = totals["Συνολική Παραγωγή (MWh)"];
    const totalFuelCost = totals["Συνολικό Κόστος Καυσίμου (€)"];
    const avgFleetEff = (totalFuelCost > 0 && hgsidaVal > 0) ? (totalMwh * hgsidaVal / totalFuelCost) * 100 : 0;
    document.getElementById('kpiFleetEff').innerText = avgFleetEff > 0 ? fmtN(avgFleetEff, 1) : DASH;

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
        const rowTint = cs.row, stickyTint = cs.sticky;

        const unitFuelCost = u["Κόστος Καυσίμου (€)"];
        const unitEff = (unitFuelCost > 0 && hgsidaVal > 0) ? (u["Παραγωγή (MWh)"] * hgsidaVal / unitFuelCost) * 100 : 0;

        const MWh = fmtN(u["Παραγωγή (MWh)"], 0);
        const Eff = unitEff > 0 ? fmtN(unitEff, 1) + '%' : DASH;
        const CO2 = fmtN(u["Εκπομπές CO2 (t)"], 1) + ' t';
        const SRMC = fmtN(u["SRMC Μέσος Όρος (€/MWh)"], 2);
        const Cost = formatEuro(u["Συνολικό Κόστος (€)"]);

        const tr = document.createElement('tr');
        tr.className = `main-row ${rowTint} transition-all duration-300`;
        tr.innerHTML = `
            <td class="p-3 font-bold text-slate-200 sticky left-0 z-10 ${stickyTint} sm:bg-transparent shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] sm:shadow-none">
                <div class="flex justify-between items-center pr-1 sm:pr-0"><span>${shortName}</span></div>
            </td>
            <td class="p-3 text-right font-mono">${MWh}</td>
            <td class="p-3 text-right font-mono" style="color:${DATA_COLORS.efficiency}">${Eff}</td>
            <td class="p-3 text-right font-mono text-slate-400">${CO2}</td>
            <td class="p-3 text-right font-mono text-amber-400">${SRMC}</td>
            <td class="p-3 text-right font-semibold text-slate-300">${Cost}</td>
        `;
        tbody.appendChild(tr);

        // Κάρτα για το κινητό (Flows D23): μονάδα και κόστος στην πρώτη γραμμή, τα τέσσερα νούμερα στη δεύτερη, δεξιά στοιχισμένα· οι μονάδες μέτρησης λένε ποιο είναι ποιο
        if (cards) {
            const unit = (s) => `<span class="text-[11px] text-slate-500">${s}</span>`;
            const card = document.createElement('div');
            card.setAttribute('role', 'listitem');
            card.className = 'rounded-lg border border-slate-700/60 px-3 py-2.5';
            card.style.cssText = `border-left:3px solid ${cs.hex}; background:${cs.hex}14`;
            card.innerHTML = `
                <div class="flex justify-between items-baseline gap-3">
                    <span class="font-bold text-slate-200">${shortName}</span>
                    <span class="font-semibold text-slate-100 tabular-nums">${fmtN(u["Συνολικό Κόστος (€)"], 0)} ${unit('€')}</span>
                </div>
                <div class="grid grid-cols-2 gap-x-5 gap-y-1 mt-2 text-xs text-right tabular-nums">
                    <div class="text-slate-300">${MWh} ${unit('MWh')}</div>
                    <div style="color:${DATA_COLORS.efficiency}">${unitEff > 0 ? fmtN(unitEff, 1) + ' ' + unit('%') : DASH}</div>
                    <div class="text-slate-400">${fmtN(u["Εκπομπές CO2 (t)"], 1)} ${unit('t')}</div>
                    <div class="text-amber-400">${SRMC} ${unit('€/MWh')}</div>
                </div>`;
            cards.appendChild(card);
        }
    });
}

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

    const byDay = {};
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

        const hgsida = day["HGSIDA (€/MWh)"] || 0;
        const totals = day["Fleet Totals"];
        const srmc = totals["Μέσο SRMC Στόλου (€/MWh)"] || 0;
        
        const totalMwh = totals["Συνολική Παραγωγή (MWh)"];
        const totalFuelCost = totals["Συνολικό Κόστος Καυσίμου (€)"];
        const eff = (totalFuelCost > 0 && hgsida > 0) ? (totalMwh * hgsida / totalFuelCost) * 100 : 0;

        byDay[dayNum] = { hgsida, srmc, eff };

        if (srmc > 0 && srmc < minCost) { minCost = srmc; minCostDay = dayNum; }
        if (srmc > maxCost) { maxCost = srmc; maxCostDay = dayNum; }
        
        if (eff > 0 && eff < minEff) { minEff = eff; minEffDay = dayNum; }
        if (eff > maxEff) { maxEff = eff; maxEffDay = dayNum; }
    });

    // Άξονας από την 1η ως την τελευταία ημέρα με δεδομένα: μια ημέρα που λείπει φαίνεται ως κενό και όχι ως «πήδημα» του άξονα (D26)
    const labels = [], dates = [];
    const lastDay = Math.max(0, ...Object.keys(byDay).map(Number));
    for (let n = 1; n <= lastDay; n++) {
        const dd = String(n).padStart(2, '0'), v = byDay[dd];
        labels.push(dd); dates.push(`${selectedMonth}-${dd}`);
        hgsidaData.push(v ? v.hgsida : null); srmcData.push(v ? v.srmc : null); effData.push(v ? v.eff : null);
    }

    // Οι ακραίες ημέρες του μήνα: μία γραμμή κάτω από τον τίτλο του γραφήματος (D41, αντί για τέσσερις κάρτες)
    const tt = i18n[currentLang], dw = tt.dayWord;
    const ext = (label, val, unit, cls, day) => `${escapeHtml(label)} <span class="${cls} font-semibold tabular-nums">${val === null ? DASH : fmtN(val, unit === '%' ? 1 : 2) + ' ' + unit}</span>${day ? ` <span class="text-slate-500">(${escapeHtml(dw)} ${day})</span>` : ''}`;
    document.getElementById('monthlyExtremes').innerHTML = [
        ext(tt.lblHighSrmc, maxCost !== -Infinity ? maxCost : null, '€/MWh', 'text-rose-400', maxCostDay),
        ext(tt.lblLowSrmc, minCost !== Infinity ? minCost : null, '€/MWh', 'text-emerald-400', minCostDay),
        ext(tt.lblLowEff, minEff !== Infinity ? minEff : null, '%', 'text-orange-400', minEffDay),
        ext(tt.lblHighEff, maxEff !== -Infinity ? maxEff : null, '%', 'text-emerald-400', maxEffDay)
    ].join(' · ');

    renderMonthlyChart(labels, dates, hgsidaData, srmcData, effData);
    updateMonthlyBoxes();
}

function renderMonthlyChart(labels, dates, hgsidaData, srmcData, effData) {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (monthlyChartInst) monthlyChartInst.destroy();
    hideChartTip();
    applyChartDefaults();
    const T = i18n[currentLang];

    monthlyChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    // Αόρατο βοηθητικό dataset: ένα σημείο ανά ημέρα, ώστε το tooltip να δουλεύει και πάνω από ημέρα χωρίς δεδομένα
                    // (το Chart.js αγνοεί τα null σημεία στην αλληλεπίδραση). Δεν φαίνεται ούτε στο υπόμνημα.
                    label: '',
                    data: labels.map(() => 0),
                    showLine: false, pointRadius: 0, pointHoverRadius: 0, borderWidth: 0, hitRadius: 0,
                    yAxisID: 'y'
                },
                {
                    label: T.legHgsida,
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
                    label: T.legSrmc,
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
                    label: T.legEff,
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
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { size: 12 }, usePointStyle: true, filter: (item) => item.text !== '' } },
                tooltip: tipOff(i => monthlyTip(i, dates, hgsidaData, srmcData, effData))
            },
            scales: {
                x: { grid: { color: '#1e293b' }, title: { display: true, text: T.axisDay, color: '#64748b' } },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: '#334155' },
                    title: { display: true, text: T.axisCost },
                    min: 0,
                    ticks: yTicks
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 40,
                    max: 60,
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: T.axisEff }
                }
            }
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

// D29/D30: τα MWh των περιορισμών τα υπολογίζει το update_data.py (ρητός πίνακας ονομάτων, πραγματικές ώρες)· εδώ μόνο αθροίζονται ανά ημέρα.
function constrainedFromPython(selectedMonth) {
    const byDay = {};
    rawData.constrained.forEach(r => {
        const d = parseDate(r.Date);
        if (!d.startsWith(selectedMonth)) return;
        byDay[d] = (byDay[d] || 0) + (Number(r.MWh) || 0);
    });
    return byDay;
}

function updateSurplusTab() {
    const monthSelect = document.getElementById('monthSelect');
    if (!monthSelect || !rawData || !rawData.daily_surplus || !Array.isArray(rawData.constrained)) return;
    
    const selectedMonth = monthSelect.value;
    if (!selectedMonth) return;

    const dailyConstrainedMwh = constrainedFromPython(selectedMonth);

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
    
    const labels = [], dates = [];
    const surplusData = [];
    const constraintsData = [];
    let sumSurplus = 0;
    let sumConstraints = 0;

    // Άξονας από την 1η ως την τελευταία ημέρα με δεδομένα· οι ημέρες που λείπουν (χωρίς SCADA) μένουν κενές (D26)
    const present = new Set(allDatesInMonth);
    const lastDay = allDatesInMonth.length ? Math.max(...allDatesInMonth.map(x => Number(x.split('-')[2]))) : 0;
    for (let n = 1; n <= lastDay; n++) {
        const dd = String(n).padStart(2, '0'), day = `${selectedMonth}-${dd}`;
        labels.push(dd); dates.push(day);
        if (!present.has(day)) { surplusData.push(null); constraintsData.push(null); continue; }

        let s = Math.abs(dailySurplusMap[day] || 0);
        let c = dailyConstrainedMwh[day] || 0;

        surplusData.push(s);
        constraintsData.push(c);

        sumSurplus += s;
        sumConstraints += c;
    }

    document.getElementById('kpiMonthSurplus').innerText = labels.length ? fmtN(sumSurplus, 0) : DASH;
    document.getElementById('kpiMonthConstraints').innerText = labels.length ? fmtN(sumConstraints, 0) : DASH;

    renderSurplusChart(labels, dates, surplusData, constraintsData);
    updateSurplusBoxes();
}

function renderSurplusChart(labels, dates, surplusData, constraintsData) {
    const canvas = document.getElementById('surplusChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (surplusChartInst) surplusChartInst.destroy();
    hideChartTip();
    applyChartDefaults();
    const T = i18n[currentLang];

    surplusChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: T.legSurplus,
                    data: surplusData,
                    backgroundColor: DATA_COLORS.surplus,
                    borderRadius: 4
                },
                {
                    label: T.legConstraints,
                    data: constraintsData,
                    backgroundColor: DATA_COLORS.constraints,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12 } } },
                tooltip: tipOff(i => surplusTip(i, dates, surplusData, constraintsData))
            },
            scales: {
                x: { grid: { display: false }, title: { display: true, text: T.axisDay, color: '#64748b' } },
                y: { grid: { color: '#334155' }, title: { display: true, text: 'MWh' }, ticks: yTicks }
            }
        }
    });
}

// ==========================================
// ΚΟΥΜΠΙ «ΕΠΑΝΩ» (κινητό, D27, όπως BESS D72): εμφανίζεται όταν τα tabs έχουν βγει από την οθόνη και σε γυρίζει στην κορυφή,
// όπου είναι η επιλογή ημερομηνίας, η μεθοδολογία, η γλώσσα και τα tabs. Δεν πιάνει μόνιμο χώρο.
// ==========================================
// ==========================================
// TAB 5: DAILY REVIEW (D37)
// ==========================================
// Τα νούμερα του μοντέλου (διάσπαση κόστους, διακοπές και επιστροφές, περιορισμοί) τα υπολόγισε το Python και είναι στο data/review.json
// (δικά μας παράγωγα, χωρίς τιμή τρίτου, K33/K34). Εδώ μόνο διαφορές, ταξινόμηση και κείμενο, από αυτό και από τα οικονομικά της σελίδας.
const REVIEW_TOP_UNITS = 6;           // πόσες μονάδες φαίνονται πριν το «Εμφάνιση όλων»
const REVIEW_NEUTRAL_EUR = 5000;      // επίδραση κάτω από 5.000 € = «χωρίς επίδραση» στο κείμενο
const REVIEW_MEDIAN_DAYS = 30;        // η απόδοση κάθε μονάδας συγκρίνεται με τη διάμεσο των προηγούμενων 30 ημερών της
const REVIEW_BASE_DAYS = 7;
const REVIEW_BASE_MIN = 3;            // ίδιο όριο με το Python (BASELINE_MIN_DAYS)
const RETURN_MIN_DAYS = 3;            // ίδιο με το Python (RETURN_MIN_OFF_DAYS): «εκτός» = τουλάχιστον 3 ημέρες χωρίς παραγωγή

function loadReviewData() {
    if (reviewState === 'loading' || reviewState === 'ready') return;
    reviewState = 'loading';
    getJSON('data/review.json', { cache: 'no-cache' })
        .then(j => { reviewData = (j && j.days) ? j : null; reviewState = reviewData ? 'ready' : 'error'; })
        .catch(e => { console.warn('review.json δεν φορτώθηκε:', e); reviewState = 'error'; })
        .then(() => { updateReviewTab(); updateMonthlyBoxes(); updateSurplusBoxes(); });
}
function setReviewBase(b) { reviewBase = b; updateReviewTab(); }
function toggleReviewUnits() { reviewShowAll = !reviewShowAll; updateReviewTab(); }

function reviewShiftDate(iso, k) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - k)).toISOString().slice(0, 10);
}
const reviewMedian = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const reviewMean = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;

function updateReviewTab() {
    if (!rawData) return;
    const t = i18n[currentLang];
    const msg = document.getElementById('reviewMsg'), body = document.getElementById('reviewBody');
    const showMsg = (text, go) => showMissing('reviewMsg', 'reviewBody', text, go);
    const dSel = document.getElementById('dateSelect'), day = dSel && dSel.value;
    if (!day) return;
    if (reviewState === 'idle') loadReviewData();
    if (reviewState === 'loading') { showMsg(t.revLoading); return; }
    if (reviewState !== 'ready') { showMsg(t.revError); return; }

    const eco = {};
    (rawData.daily_economics || []).forEach(e => { eco[parseDate(e.Ημερομηνία)] = e; });
    const E = eco[day];
    if (!E || !E.Units || E.Units.length === 0) {
        const latestEco = latestEcoDay(day);
        showMsg(t['revMiss' + dayMissingKind(day)], latestEco && latestEco !== day ? { day: latestEco, label: t.revGoLatest.replace('{date}', fmtDay(latestEco, true)) } : null);
        return;
    }
    msg.classList.add('hidden'); body.classList.remove('hidden');

    const rd = (reviewData.days && reviewData.days[day]) || {};
    const agg = (e) => {
        const tt = e['Fleet Totals'], h = e['HGSIDA (€/MWh)'] || 0, fuel = tt['Συνολικό Κόστος Καυσίμου (€)'];
        return { mwh: tt['Συνολική Παραγωγή (MWh)'], cost: tt['Συνολικό Κόστος Στόλου (€)'], th: h > 0 ? fuel / h : 0 };
    };
    // Βάσεις σύγκρισης: η προηγούμενη ημέρα του ημερολογίου ή ο μέσος των προηγούμενων (έως 7) ημερών με οικονομικά
    const prevIso = reviewShiftDate(day, 1);
    const prevRows = eco[prevIso] && eco[prevIso].Units ? [eco[prevIso]] : [];
    const sevenRows = [];
    for (let k = 1; k <= REVIEW_BASE_DAYS; k++) { const e = eco[reviewShiftDate(day, k)]; if (e && e.Units && e.Units.length) sevenRows.push(e); }
    const avail = { prev: prevRows.length === 1 && !!rd.vs_prev, '7d': sevenRows.length >= REVIEW_BASE_MIN && !!rd.vs_7d };
    const base = avail[reviewBase] ? reviewBase : (avail.prev ? 'prev' : (avail['7d'] ? '7d' : null));
    const baseRows = base === 'prev' ? prevRows : (base === '7d' ? sevenRows : []);
    const fx = base === 'prev' ? rd.vs_prev : (base === '7d' ? rd.vs_7d : null);

    // Τίτλος και κουμπιά σύγκρισης
    const longDate = new Intl.DateTimeFormat(t.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'));
    document.getElementById('reviewTitle').textContent = `${t.revTitle} · ${longDate}`;
    const CHIP_ON = 'px-3 py-1.5 rounded-full text-xs font-semibold border border-acc-400 bg-acc-400 text-slate-900';
    const CHIP_OFF = 'px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-600 bg-slate-800 text-slate-300 hover:text-white transition';
    const CHIP_DIS = 'px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-700 bg-slate-800/50 text-slate-600 cursor-not-allowed';
    [['reviewBtnPrev', 'prev', `${t.revPrev} (${fmtDay(prevIso, true)})`], ['reviewBtn7d', '7d', t.rev7d]].forEach(([id, key, label]) => {
        const b = document.getElementById(id);
        b.textContent = label; b.disabled = !avail[key];
        b.className = !avail[key] ? CHIP_DIS : (base === key ? CHIP_ON : CHIP_OFF);
        b.setAttribute('aria-pressed', base === key ? 'true' : 'false');
    });

    // Σύνολα ημέρας και βάσης
    const today = agg(E), nB = baseRows.length;
    const baseAgg = nB ? (() => { const a = baseRows.map(agg); return { mwh: reviewMean(a, x => x.mwh), cost: reviewMean(a, x => x.cost), th: reviewMean(a, x => x.th) }; })() : null;
    const srmcToday = today.mwh > 0 ? today.cost / today.mwh : null;   // ίδιος υπολογισμός (κόστος ÷ MWh) για την ημέρα και τη βάση, χωρίς τη στρογγυλεμένη αποθηκευμένη τιμή
    const effToday = today.th > 0 ? today.mwh / today.th * 100 : null;
    const effBase = baseAgg && baseAgg.th > 0 ? baseAgg.mwh / baseAgg.th * 100 : null;
    const G = 'text-emerald-400', R_ = 'text-rose-400', N = 'text-slate-400';
    const upBad = (d) => (roundsToZero(d, 2) ? N : (d > 0 ? R_ : G));     // κόστος: πάνω = κόκκινο
    const upGood = (d) => (roundsToZero(d, 1) ? N : (d > 0 ? G : R_));    // απόδοση: πάνω = πράσινο

    // Κείμενο
    const eur = (v) => `${fmtN(v / 1e6, 2, !roundsToZero(v / 1e6, 2))} ${t.revMEur}`;
    const sentenceEl = document.getElementById('reviewSentence');
    if (!fx || !baseAgg) {
        sentenceEl.textContent = t.revNoBase;
    } else {
        const dCost = today.cost - baseAgg.cost, pct = baseAgg.cost ? dCost / baseAgg.cost * 100 : 0, dGen = (today.mwh - baseAgg.mwh) / 1000;
        const baseLabel = base === 'prev' ? t.revBasePrev.replace('{date}', fmtDay(prevIso, true)) : t.revBase7.replace('{n}', String(nB));
        const ph = (k, v) => (Math.abs(v) < REVIEW_NEUTRAL_EUR ? t.revPh[k][2] : t.revPh[k][v < 0 ? 0 : 1]);
        const ranked = ['vol', 'gas', 'co2', 'mix'].map(k => ({ k, v: fx[k] })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
        let text = roundsToZero(dCost / 1e6, 2)
            ? t.revS1Same.replace('{p}', fmtN(pct, 1, true)).replace('{base}', baseLabel)
            : t.revS1.replace('{dir}', dCost < 0 ? t.revFell : t.revRose).replace('{x}', fmtN(Math.abs(dCost) / 1e6, 2)).replace('{p}', fmtN(pct, 1, true)).replace('{base}', baseLabel);
        const m0 = ranked[0];
        text += ' ' + t.revS2.replace('{f}', ph(m0.k, m0.v)).replace('{v}', eur(m0.v)).replace('{extra}', m0.k === 'vol' ? `, ${fmtN(dGen, 1, true)} GWh` : '');
        const rest = ranked.slice(1).map(p => `${ph(p.k, p.v)} (${eur(p.v)})`);
        text += ' ' + t.revS3.replace('{list}', rest.slice(0, -1).join(', ') + ' ' + t.revAnd + ' ' + rest[rest.length - 1]);
        sentenceEl.textContent = text;
    }

    // KPI
    const kpi = (label, value, unit, delta, cls, color, sub) =>
        `<div class="rounded-lg border border-slate-700/70 bg-slate-900/40 p-3"><div class="text-[11px] text-slate-400">${escapeHtml(label)}</div>` +
        `<div class="mt-1 flex items-baseline gap-1"><span class="text-xl sm:text-2xl font-bold tabular-nums" style="color:${color}">${value}</span><span class="text-xs text-slate-500">${escapeHtml(unit)}</span></div>` +
        `<div class="text-[11px] mt-0.5 tabular-nums ${cls}">${delta || '&nbsp;'}</div>` + (sub ? `<div class="text-[11px] text-slate-500 tabular-nums">${sub}</div>` : '') + `</div>`;
    const dC = baseAgg ? today.cost - baseAgg.cost : null, dG = baseAgg ? (today.mwh - baseAgg.mwh) / 1000 : null;
    const srmcBase = baseAgg && baseAgg.mwh ? baseAgg.cost / baseAgg.mwh : null, dS = srmcBase !== null && srmcToday !== null ? srmcToday - srmcBase : null;
    const dE = effToday !== null && effBase !== null ? effToday - effBase : null;
    document.getElementById('reviewKpis').innerHTML = [
        kpi(t.revKpiCost, fmtN(today.cost / 1e6, 2), t.revMEur, dC === null ? '' : `${fmtN(dC / 1e6, 2, !roundsToZero(dC / 1e6, 2))} ${t.revMEur} (${fmtN(dC / baseAgg.cost * 100, 1, true)}%)`, dC === null ? N : upBad(dC / 1e6), '#fb7185'),
        kpi(t.revKpiGen, fmtN(today.mwh / 1000, 1), 'GWh', dG === null ? '' : `${fmtN(dG, 1, !roundsToZero(dG, 1))} GWh (${fmtN(dG * 1000 / baseAgg.mwh * 100, 1, true)}%)`, N, '#fb923c'),
        kpi(t.revKpiSrmc, srmcToday === null ? DASH : fmtN(srmcToday, 2), '€/MWh', dS === null ? '' : `${fmtN(dS, 2, !roundsToZero(dS, 2))} €/MWh`, dS === null ? N : upBad(dS), DATA_COLORS.srmc),
        kpi(t.revKpiEff, effToday === null ? DASH : fmtN(effToday, 1), '%', dE === null ? '' : `${fmtN(dE, 1, !roundsToZero(dE, 1))} ${t.revPts}`, dE === null ? N : upGood(dE), DATA_COLORS.efficiency, `${t.revKpiGas} ${fmtN(today.th / 1000, 1)} GWh`)
    ].join('');

    // Τι κίνησε το κόστος
    const fxEl = document.getElementById('reviewFx'), fxSub = document.getElementById('reviewFxSub');
    if (!fx) {
        fxSub.textContent = ''; fxEl.innerHTML = `<p class="text-sm text-slate-400">${escapeHtml(t.revNoBase)}</p>`;
    } else {
        fxSub.textContent = `${t.revFxSub} (${fmtN(baseAgg.cost / 1e6, 2)} → ${fmtN(today.cost / 1e6, 2)} ${t.revMEur})`;
        const mx = Math.max(...['vol', 'gas', 'co2', 'mix'].map(k => Math.abs(fx[k])), 1);
        const half = (v, left) => ((left ? v < 0 : v > 0) ? `<i style="display:block;height:100%;width:${(Math.abs(v) / mx * 100).toFixed(1)}%;background:${v < 0 ? '#34d399' : '#f87171'}"></i>` : '');
        fxEl.innerHTML = ['vol', 'gas', 'co2', 'mix'].map(k => {
            const v = fx[k], cls = roundsToZero(v / 1e6, 2) ? N : (v > 0 ? R_ : G);
            return `<div class="grid grid-cols-[1fr_auto] sm:grid-cols-[12rem_1fr_6.5rem] items-center gap-x-3 gap-y-1 py-1.5"><span class="text-sm text-slate-300">${escapeHtml(t.revFx[k])}</span>` +
                `<span class="text-right sm:order-3 text-sm font-bold tabular-nums ${cls}">${eur(v)}</span>` +
                `<div class="col-span-2 sm:col-span-1 sm:order-2 grid grid-cols-2 h-4 rounded bg-slate-900 overflow-hidden"><div class="flex justify-end">${half(v, true)}</div><div class="flex">${half(v, false)}</div></div></div>`;
        }).join('') + `<div class="flex justify-between items-baseline gap-3 mt-3 pt-3 border-t border-dashed border-slate-600 text-sm text-slate-400"><span>${escapeHtml(t.revFxTotal)}</span><b class="text-base tabular-nums whitespace-nowrap ${upBad(fx.total / 1e6)}">${eur(fx.total)}</b></div>`;
    }

    // Συμβάντα της ημέρας: εκτός λειτουργίας, επιστροφές, generic constraints
    const chip = (cls, text, title) => `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}"${title ? ` title="${escapeHtml(title)}"` : ''}>${escapeHtml(text)}</span>`;
    const none = `<span class="text-xs text-slate-500">${escapeHtml(t.revNone)}</span>`;
    const nameOf = (u) => getShortUnitName(u);
    const outs = (rd.out || []).map(([u, n, plus]) => chip('border-amber-500/40 bg-amber-500/10 text-amber-300', `${nameOf(u)} · ${n}${plus ? '+' : ''} ${n === 1 ? t.revDay1 : t.revDays}`));
    const rets = (reviewData.events || []).filter(e => e.d === day).map(e => chip('border-emerald-500/40 bg-emerald-500/10 text-emerald-300', `${nameOf(e.u)} · ${t.revAfter.replace('{n}', e.off + (e.plus ? '+' : ''))}`, `${t.revFirstDay}: ${fmtN(e.mwh, 0)} MWh`));
    const cons = (rd.cons || []).map(c => chip('border-indigo-400/40 bg-indigo-400/10 text-indigo-200', `${nameOf(c.u)} ${c.w[0]}–${c.w[1]} · ${fmtN(c.mwh, 0)} MWh`));
    const group = (label, items) => `<div><div class="text-[11px] text-slate-500 mb-1.5">${escapeHtml(label)}</div><div class="flex flex-wrap gap-1.5">${items.length ? items.join('') : none}</div></div>`;
    document.getElementById('reviewDay').innerHTML = group(t.revOut, outs) + group(t.revReturns, rets) + group(t.revCons, cons);

    // Μονάδες, ταξινομημένες κατά την επίδρασή τους στο κόστος (και όσες σταμάτησαν: χωρίς αυτές το άθροισμα δεν θα έκλεινε στο σύνολο)
    const unitsOf = (e) => { const m = {}; (e.Units || []).forEach(u => { m[getCanonicalUnitName(u['Μονάδα'])] = u; }); return m; };
    const uToday = unitsOf(E), uBase = baseRows.map(unitsOf);
    const names = new Set([...Object.keys(uToday), ...uBase.flatMap(m => Object.keys(m))]);
    const eff = (u, h) => (u && u['Κόστος Καυσίμου (€)'] > 0 && h > 0 ? u['Παραγωγή (MWh)'] * h / u['Κόστος Καυσίμου (€)'] * 100 : null);
    const rows = [...names].map(name => {
        const ut = uToday[name] || null, bMwh = nB ? uBase.reduce((s, m) => s + (m[name] ? m[name]['Παραγωγή (MWh)'] : 0), 0) / nB : 0;
        const bCost = nB ? uBase.reduce((s, m) => s + (m[name] ? m[name]['Συνολικό Κόστος (€)'] : 0), 0) / nB : 0;
        const hist = [];
        for (let k = 1; k <= REVIEW_MEDIAN_DAYS; k++) { const e = eco[reviewShiftDate(day, k)]; if (!e) continue; const v = eff((e.Units || []).find(u => getCanonicalUnitName(u['Μονάδα']) === name), e['HGSIDA (€/MWh)']); if (v !== null) hist.push(v); }
        const eT = eff(ut, E['HGSIDA (€/MWh)']);
        return { name, ut, mwh: ut ? ut['Παραγωγή (MWh)'] : 0, cost: ut ? ut['Συνολικό Κόστος (€)'] : 0, dMwh: ut ? ut['Παραγωγή (MWh)'] - bMwh : -bMwh,
                 dCost: nB ? (ut ? ut['Συνολικό Κόστος (€)'] : 0) - bCost : null, eff: eT, dEff: eT !== null && hist.length >= 5 ? eT - reviewMedian(hist) : null,
                 srmc: ut ? ut['SRMC Μέσος Όρος (€/MWh)'] : null, con: (rd.cons || []).find(c => c.u === name) || null };
    }).filter(r => r.ut || (r.dCost !== null && Math.abs(r.dCost) > 0.5));
    rows.sort((a, b) => nB ? (Math.abs(b.dCost) - Math.abs(a.dCost) || a.name.localeCompare(b.name)) : (b.cost - a.cost || a.name.localeCompare(b.name)));
    const maxAbs = Math.max(...rows.map(r => Math.abs(r.dCost || 0)), 1);
    const shown = reviewShowAll ? rows : rows.slice(0, REVIEW_TOP_UNITS);
    const kEur = (v) => `${fmtN(v / 1000, 0, !roundsToZero(v / 1000, 0))} ${t.revKEur}`;
    document.getElementById('reviewUnits').innerHTML = shown.map(r => {
        const meta = getUnitMetadata(r.name), cs = CLASS_STYLE[meta.order] || CLASS_STYLE[3];
        const dc = r.dCost === null ? '' : `<div class="font-semibold tabular-nums ${upBad(r.dCost)}">${kEur(r.dCost)}</div>` +
            `<div class="grid grid-cols-2 h-1.5 mt-1 rounded bg-slate-900/70 overflow-hidden"><div class="flex justify-end">${r.dCost < 0 ? `<i style="display:block;height:100%;width:${(Math.abs(r.dCost) / maxAbs * 100).toFixed(1)}%;background:#34d399"></i>` : ''}</div><div class="flex">${r.dCost > 0 ? `<i style="display:block;height:100%;width:${(Math.abs(r.dCost) / maxAbs * 100).toFixed(1)}%;background:#f87171"></i>` : ''}</div></div>`;
        const badge = r.con ? `<div class="mt-1"><span class="inline-block text-[10px] font-bold rounded px-1.5 py-0.5 border border-indigo-400/40 bg-indigo-400/10 text-indigo-200 max-w-full break-words">${escapeHtml(t.revConShort)} ${escapeHtml(r.con.w[0])}–${escapeHtml(r.con.w[1])}</span></div>` : (r.ut ? '' : `<div class="mt-1"><span class="inline-block text-[10px] font-bold rounded px-1.5 py-0.5 border border-amber-500/40 bg-amber-500/10 text-amber-300 max-w-full break-words">${escapeHtml(t.revNoOutput)}</span></div>`);
        const unitSpan = (s) => `<span class="text-[11px] text-slate-500">${s}</span>`;
        const dM = nB ? `<div class="text-[11px] tabular-nums ${N}">${fmtN(r.dMwh, 0, !roundsToZero(r.dMwh, 0))}</div>` : '';
        const dEf = r.dEff !== null ? `<div class="text-[11px] tabular-nums ${upGood(r.dEff)}" title="${escapeHtml(t.revVsMedianTip)}">${fmtN(r.dEff, 1, !roundsToZero(r.dEff, 1))} ${escapeHtml(t.revVsMedian)}</div>` : '<div class="text-[11px]">&nbsp;</div>';
        return `<div role="listitem" class="rounded-lg border border-slate-700/60 px-3 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[10rem_1fr_1.4fr_1fr_1.6fr] gap-x-4 gap-y-2 items-start" style="border-left:3px solid ${cs.hex}; background:${cs.hex}14">` +
            `<div class="order-1 md:order-none font-bold text-slate-200">${escapeHtml(nameOf(r.name))}${badge}</div>` +
            `<div class="order-2 md:order-none md:col-start-5 md:row-start-1 text-right whitespace-nowrap min-w-[5.5rem] md:min-w-0">${dc}</div>` +
            `<div class="order-3 md:order-none col-span-2 md:col-span-3 md:col-start-2 md:row-start-1 grid grid-cols-3 gap-x-3">` +
              `<div><div class="text-sm tabular-nums text-slate-200">${fmtN(r.mwh, 0)} ${unitSpan('MWh')}</div>${dM}</div>` +
              `<div><div class="text-sm tabular-nums" style="color:${DATA_COLORS.efficiency}">${r.eff === null ? DASH : fmtN(r.eff, 1) + ' ' + unitSpan('%')}</div>${dEf}</div>` +
              `<div><div class="text-sm tabular-nums text-amber-400">${r.srmc === null ? DASH : fmtN(r.srmc, 2) + ' ' + unitSpan('€/MWh')}</div></div>` +
            `</div></div>`;
    }).join('');
    const more = document.getElementById('reviewMore');
    if (rows.length > REVIEW_TOP_UNITS) {
        more.classList.remove('hidden');
        more.textContent = reviewShowAll ? t.revShowTop : t.revShowAll.replace('{n}', String(rows.length));
        more.setAttribute('aria-expanded', reviewShowAll ? 'true' : 'false');
    } else { more.classList.add('hidden'); }
}

// ==========================================
// BOXES ΜΗΝΙΑΙΑΣ ΚΛΙΜΑΚΑΣ (D40): Μηνιαία ανάλυση και Περιορισμοί
// ==========================================
// Τα νούμερα (διάσπαση κόστους μήνα, επιστροφές, επίδραση περιορισμών) τα υπολόγισε το Python (data/review.json). Η σελίδα δείχνει, και υπολογίζει
// μόνο μέσους όρους ΗΜΕΡΩΝ από τα οικονομικά που ήδη έχει (HGSIDA) και τον χάρτη παραγωγής από το ημερήσιο SCADA. Φορτώνονται ΜΟΝΟ όταν ανοίγει ένα από τα tabs.
function reviewPrevMonth(m) { const [y, mm] = m.split('-').map(Number); return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`; }
function boxGuard(tab, msgId, bodyId) {
    // Κοινός έλεγχος: επιστρέφει {t, month, mo} όταν υπάρχουν στοιχεία, αλλιώς δείχνει το κατάλληλο μήνυμα και επιστρέφει null
    if (!rawData) return null;
    const t = i18n[currentLang], msg = document.getElementById(msgId), body = document.getElementById(bodyId);
    const showMsg = (text) => { msg.textContent = text; msg.classList.remove('hidden'); body.classList.add('hidden'); };
    const mSel = document.getElementById('monthSelect'), month = mSel && mSel.value;
    if (!month) return null;
    if (reviewState === 'idle') loadReviewData();
    if (reviewState === 'loading') { showMsg(t.revLoading); return null; }
    if (reviewState !== 'ready') { showMsg(t.revError); return null; }
    const mo = reviewData.months && reviewData.months[month];
    if (!mo) { showMsg(t.mbNoMonth); return null; }
    msg.classList.add('hidden'); body.classList.remove('hidden');
    return { t, month, mo };
}
// Η πρώτη ημέρα του ιστορικού μας, από το review.json (όχι γραμμένη στα κείμενα: αλλάζει όταν επεκτείνουμε προς τα πίσω)
function reviewFirstDayLabel() {
    return reviewData && reviewData.first_day ? fmtDay(reviewData.first_day) : '';
}
function hexToRgb(hex) { const h = hex.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substring(i, i + 2), 16)); }

function updateMonthlyBoxes() {
    const g = boxGuard('ispScada', 'mbMsg', 'mbBody');
    if (!g) return;
    const { t, month, mo } = g, pm = reviewPrevMonth(month), po = reviewData.months[pm] || null;
    // D43: ο ΠΡΩΤΟΣ μήνας του ιστορικού δεν έχει προηγούμενο: μία κάρτα πλήρους πλάτους «Ο μήνας σε αριθμούς» με μόνο τις τιμές του, και η κάρτα «τι κίνησε το κόστος» κρύβεται
    const single = !po;
    document.getElementById('mbCmpCard').classList.toggle('lg:col-span-2', single);
    document.getElementById('mbFxCard').classList.toggle('hidden', single);
    document.getElementById('mbCmpTitle').textContent = single ? t.mbCmpTitleSingle : t.mbCmpTitle;
    const hgMean = (m) => {
        const v = (rawData.daily_economics || []).filter(e => parseDate(e.Ημερομηνία).startsWith(m)).map(e => e['HGSIDA (€/MWh)']).filter(x => x > 0);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const N = 'text-slate-400', G = 'text-emerald-400', R_ = 'text-rose-400';
    // --- Ο μήνας έναντι του προηγούμενου (ανά ημέρα, μέσος όρος)
    document.getElementById('mbCmpSub').textContent = po ? t.mbCmpSub.replace('{m}', fmtMonth(month)).replace('{n}', mo.n).replace('{p}', fmtMonth(pm)).replace('{q}', po.n) : t.mbCmpSubSingle.replace('{m}', fmtMonth(month)).replace('{n}', mo.n);
    const rows = [
        [t.mbGas, mo.th_d / 1000, po ? po.th_d / 1000 : null, 1, 'pct', N], [t.mbCost, mo.cost_d / 1e6, po ? po.cost_d / 1e6 : null, 2, 'pct', 'up'],
        [t.mbGen, mo.mwh_d / 1000, po ? po.mwh_d / 1000 : null, 1, 'pct', N], [t.mbEff, mo.eff, po ? po.eff : null, 1, 'pts', 'eff'],
        [t.mbHg, hgMean(month), hgMean(pm), 2, 'pct', 'up'], [t.mbCo2, mo.tons_d, po ? po.tons_d : null, 0, 'pct', N]
    ];
    const cmp = rows.map(([label, cur, prev, dec, kind, tone]) => {
        let ch = '–', cls = N;
        if (cur !== null && prev !== null && prev !== 0) {
            const dv = kind === 'pts' ? cur - prev : (cur / prev - 1) * 100;
            ch = `${fmtN(dv, 1, !roundsToZero(dv, 1))}${kind === 'pts' ? ' ' + t.revPts : '%'}`;
            cls = roundsToZero(dv, 1) ? N : (tone === 'up' ? (dv > 0 ? R_ : G) : (tone === 'eff' ? (dv > 0 ? G : R_) : N));
        }
        return { label, cur: cur === null ? DASH : fmtN(cur, dec), prev: prev === null ? DASH : fmtN(prev, dec), ch, cls };
    });
    // Υπολογιστής/tablet: πίνακας· κινητό: στοιβαγμένες γραμμές (η ετικέτα του μεγέθους χρειάζεται πλάτος)
    const thc = (txt, cls) => `<th class="py-1.5 ${cls} font-semibold text-right">${escapeHtml(txt)}</th>`;
    const tbl = `<table class="hidden sm:table w-full ${single ? 'max-w-xl' : ''} text-sm"><thead><tr class="text-left text-[11px] text-slate-500"><th class="py-1.5 pr-2 font-semibold">${escapeHtml(t.mbColMetric)}</th>${thc(fmtMonth(month), 'px-2')}${single ? '' : thc(fmtMonth(pm), 'px-2') + thc(t.mbColChange, 'pl-2')}</tr></thead><tbody>` +
        cmp.map(r => `<tr class="border-t border-slate-700/60"><td class="py-2 pr-2 text-slate-300">${escapeHtml(r.label)}</td><td class="py-2 px-2 text-right font-bold tabular-nums text-slate-100">${r.cur}</td>${single ? '' : `<td class="py-2 px-2 text-right tabular-nums text-slate-500">${r.prev}</td><td class="py-2 pl-2 text-right tabular-nums ${r.cls}">${r.ch}</td>`}</tr>`).join('') + `</tbody></table>`;
    const stack = `<div class="sm:hidden">` + cmp.map((r, i) => single
        ? `<div class="py-2.5 ${i ? 'border-t border-slate-700/60' : ''} flex justify-between items-baseline gap-3"><span class="text-sm text-slate-300">${escapeHtml(r.label)}</span><b class="text-base tabular-nums text-slate-100">${r.cur}</b></div>`
        : `<div class="py-2.5 ${i ? 'border-t border-slate-700/60' : ''}"><div class="flex justify-between items-baseline gap-3"><span class="text-sm text-slate-300">${escapeHtml(r.label)}</span><span class="text-sm tabular-nums ${r.cls}">${r.ch}</span></div><div class="mt-0.5 text-xs tabular-nums"><b class="text-base text-slate-100">${r.cur}</b> <span class="text-slate-500">· ${escapeHtml(fmtMonth(pm))}: ${r.prev}</span></div></div>`).join('') + `</div>`;
    document.getElementById('mbCmp').innerHTML = tbl + stack;
    // --- Τι κίνησε το κόστος τον μήνα
    const fx = mo.vs_prev, fxEl = document.getElementById('mbFx'), fxSub = document.getElementById('mbFxSub'), fxNote = document.getElementById('mbFxNote');
    if (!fx || !po) { fxSub.textContent = ''; fxNote.textContent = ''; fxEl.innerHTML = `<p class="text-sm text-slate-400">${escapeHtml(t.mbNoPrev)}</p>`; }
    else {
        const eur = (v) => `${fmtN(v / 1e6, 2, !roundsToZero(v / 1e6, 2))} ${t.revMEur}`;
        fxSub.textContent = `${t.mbFxSub} (${fmtN(po.cost_d / 1e6, 2)} → ${fmtN(mo.cost_d / 1e6, 2)} ${t.revMEur})`;
        const keys = ['vol', 'gas', 'co2', 'mix'], mx = Math.max(...keys.map(k => Math.abs(fx[k])), 1);
        const half = (v, left) => ((left ? v < 0 : v > 0) ? `<i style="display:block;height:100%;width:${(Math.abs(v) / mx * 100).toFixed(1)}%;background:${v < 0 ? '#34d399' : '#f87171'}"></i>` : '');
        fxEl.innerHTML = keys.map(k => {
            const v = fx[k], cls = roundsToZero(v / 1e6, 2) ? N : (v > 0 ? R_ : G);
            return `<div class="grid grid-cols-[1fr_auto] sm:grid-cols-[12rem_1fr_6.5rem] items-center gap-x-3 gap-y-1 py-1.5"><span class="text-sm text-slate-300">${escapeHtml(t.revFx[k])}</span><span class="text-right sm:order-3 text-sm font-bold tabular-nums ${cls}">${eur(v)}</span>` +
                `<div class="col-span-2 sm:col-span-1 sm:order-2 grid grid-cols-2 h-4 rounded bg-slate-900 overflow-hidden"><div class="flex justify-end">${half(v, true)}</div><div class="flex">${half(v, false)}</div></div></div>`;
        }).join('') + `<div class="flex justify-between items-baseline gap-3 mt-3 pt-3 border-t border-dashed border-slate-600 text-sm text-slate-400"><span>${escapeHtml(t.mbFxTotal)}</span><b class="text-base tabular-nums whitespace-nowrap ${fx.total > 0 ? R_ : G}">${eur(fx.total)}</b></div>`;
        const ph = (k, v) => (Math.abs(v) < REVIEW_NEUTRAL_EUR ? t.revPh[k][2] : t.revPh[k][v < 0 ? 0 : 1]);
        const rk = keys.map(k => ({ k, v: fx[k] })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
        fxNote.textContent = t.mbFxNote.replace('{f}', ph(rk[0].k, rk[0].v)).replace('{v}', eur(rk[0].v)).replace('{g}', ph(rk[1].k, rk[1].v)).replace('{w}', eur(rk[1].v));
    }
    // --- Διαθεσιμότητα μονάδων: ημερήσια παραγωγή SCADA ανά μονάδα και ημέρα του μήνα
    const mwh = {}, days = new Set();
    (rawData.scada || []).forEach(r => {
        const v = Object.values(r), date = parseDate(v[0]), name = String(v[1]).trim();
        if (!date.startsWith(month) || name === 'TOTAL GAS UNITS' || name.includes('Σύνολο') || name === 'NAN') return;
        const u = getCanonicalUnitName(name); (mwh[u] = mwh[u] || {})[date] = parseNum(v[2]); days.add(date);
    });
    const dayNums = [...days].map(x => Number(x.split('-')[2])), lastDay = dayNums.length ? Math.max(...dayNums) : 0, firstDay = dayNums.length ? Math.min(...dayNums) : 1;   // D41: από την πρώτη ημέρα με δεδομένα (ο 1ος μήνας του ιστορικού μας είναι μισός)
    const units = Object.keys(mwh).sort((a, b) => (getUnitMetadata(a).order - getUnitMetadata(b).order) || getShortUnitName(a).localeCompare(getShortUnitName(b)));
    const rets = (reviewData.events || []).filter(e => e.d.startsWith(month));
    const retSet = new Set(rets.map(e => `${e.u}|${e.d}`));
    let cells = `<div></div>`;
    // Ετικέτες ημερών: 1, 5, 10, 15…, κεντραρισμένες πάνω από το κελί τους (absolute: δεν διευρύνουν τη στήλη ούτε ξεχειλίζουν στα στενά κελιά του κινητού)
    for (let n = firstDay; n <= lastDay; n++) cells += `<div style="position:relative;height:12px">${(n === firstDay || n % 5 === 0) ? `<span style="position:absolute;left:50%;transform:translateX(-50%);font-size:9px;color:#64748b;white-space:nowrap">${n}</span>` : ''}</div>`;
    units.forEach(u => {
        const cs = CLASS_STYLE[getUnitMetadata(u).order] || CLASS_STYLE[3], mxu = Math.max(...Object.values(mwh[u]), 1), [r, gg, b] = hexToRgb(cs.hex);
        cells += `<div style="font-size:11px;font-weight:700;white-space:nowrap;padding-right:6px;color:${cs.hex};overflow:hidden;text-overflow:ellipsis">${escapeHtml(getShortUnitName(u))}</div>`;
        for (let n = firstDay; n <= lastDay; n++) {
            const date = `${month}-${String(n).padStart(2, '0')}`, v = mwh[u][date];
            const bg = v === undefined ? '#0b1220' : (v <= 1 ? '#1e293b' : `rgba(${r},${gg},${b},${(0.22 + 0.78 * Math.min(1, v / mxu)).toFixed(2)})`);
            cells += `<div title="${escapeHtml(`${fmtDay(date, true)} · ${getShortUnitName(u)} · ${v === undefined ? '–' : fmtN(v, 0) + ' MWh'}`)}" style="height:15px;border-radius:3px;background:${bg}${retSet.has(`${u}|${date}`) ? ';box-shadow:inset 0 0 0 2px #fbbf24' : ''}"></div>`;
        }
    });
    const heat = document.getElementById('mbHeat');
    heat.setAttribute('aria-label', t.mbHeatAria.replace('{m}', fmtMonth(month)));
    heat.style.cssText = `display:grid;gap:3px;align-items:center;grid-template-columns:72px repeat(${Math.max(lastDay - firstDay + 1, 1)},minmax(0,1fr))`;
    heat.innerHTML = cells;
    const sq = (bg, extra) => `<span style="display:inline-block;width:14px;height:11px;border-radius:3px;vertical-align:middle;margin-right:4px;background:${bg};${extra || ''}"></span>`;
    document.getElementById('mbLegend').innerHTML = `<span>${sq('#1e293b')}${escapeHtml(t.mbLegOut)}</span><span>${sq('rgba(129,140,248,.9)')}${escapeHtml(t.mbLegOn)}</span><span>${sq('#1e293b', 'box-shadow:inset 0 0 0 2px #fbbf24')}${escapeHtml(t.mbLegRet)}</span><span>${sq('#0b1220')}${escapeHtml(t.mbLegNoData)}</span>`;
    // --- Γεγονότα του μήνα: επιστροφές και μονάδες εκτός στο τέλος του μήνα
    const lastIso = Object.keys(reviewData.days).filter(d => d.startsWith(month)).sort().pop();
    const outEnd = ((lastIso && reviewData.days[lastIso].out) || []).filter(o => o[1] >= RETURN_MIN_DAYS);
    const evHtml = [...rets].sort((a, b) => b.d.localeCompare(a.d)).map(e => `<div class="py-1.5 border-b border-slate-700/50 text-sm"><span class="text-slate-500 text-xs mr-1">${escapeHtml(fmtDay(e.d, true))}</span><b class="text-emerald-300">${escapeHtml(getShortUnitName(e.u))}</b> ${escapeHtml(t.mbRet.replace('{n}', e.off + (e.plus ? '+' : '')))} <span class="text-[11px] text-slate-500">(${escapeHtml(t.revFirstDay)}: ${fmtN(e.mwh, 0)} MWh)</span></div>`).join('') +
        outEnd.map(o => `<div class="py-1.5 border-b border-slate-700/50 text-sm"><b class="text-amber-300">${escapeHtml(getShortUnitName(o[0]))}</b> ${escapeHtml(t.mbOutEnd.replace('{n}', o[1] + (o[2] ? '+' : '')))}</div>`).join('');
    const anyPlus = rets.some(e => e.plus) || outEnd.some(o => o[2]);
    document.getElementById('mbEvents').innerHTML = (evHtml || `<p class="text-sm text-slate-400">${escapeHtml(t.mbNoEvents)}</p>`) + (anyPlus ? `<p class="text-[11px] text-slate-500 mt-2">${escapeHtml(t.mbPlusNote.replace('{first}', reviewFirstDayLabel()))}</p>` : '');
}

function updateSurplusBoxes() {
    const g = boxGuard('surplus', 'cbMsg', 'cbBody');
    if (!g) return;
    const { t, month, mo } = g, cons = mo.cons || [];
    document.getElementById('cbSub').textContent = t.cbSub.replace('{m}', fmtMonth(month));
    const table = document.getElementById('cbTable'), kpis = document.getElementById('cbKpis'), note = document.getElementById('cbNote');
    if (!cons.length) { kpis.innerHTML = ''; note.textContent = ''; table.innerHTML = `<p class="text-sm text-slate-400">${escapeHtml(t.cbNone)}</p>`; return; }
    const sum = (k) => cons.reduce((s, r) => s + (r[k] || 0), 0);
    const kp = (label, val, unit, color) => `<div class="rounded-lg border border-slate-700/70 bg-slate-900/40 p-3"><div class="text-[11px] text-slate-400">${escapeHtml(label)}</div><div class="mt-1 flex items-baseline gap-1"><span class="text-xl sm:text-2xl font-bold tabular-nums" style="color:${color}">${val}</span><span class="text-xs text-slate-500">${escapeHtml(unit)}</span></div></div>`;
    kpis.innerHTML = kp(t.cbKGen, fmtN(sum('mwh') / 1000, 1), 'GWh', '#fb923c') + kp(t.cbKGas, fmtN(sum('xth') / 1000, 1), t.cbKGasUnit, '#fbbf24') + kp(t.cbKVal, fmtN(sum('xeur') / 1000, 0), t.revKEur, '#fb7185');
    note.textContent = t.cbNote;
    const dEff = (r) => (r.ei !== null && r.eo !== null ? r.ei - r.eo : null);
    const dTxt = (r) => { const d = dEff(r); return d === null ? DASH : fmtN(d, 1, !roundsToZero(d, 1)); };
    const dCls = (r) => { const d = dEff(r); return d === null || roundsToZero(d, 1) ? 'text-slate-400' : (d > 0 ? 'text-emerald-400' : 'text-rose-400'); };
    const pair = (a, b, dec) => `${a === null ? DASH : fmtN(a, dec)} <span class="text-slate-500">/ ${b === null ? DASH : fmtN(b, dec)}</span>`;
    const col = (r) => (CLASS_STYLE[getUnitMetadata(r.u).order] || CLASS_STYLE[3]).hex;
    const head = [t.cbColUnit, t.cbColDays, t.cbColMwh, t.cbColShare, t.cbColLoad, t.cbColEff, t.cbColDelta, t.cbColGas, t.cbColVal];
    const desk = `<div class="hidden md:block overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-[11px] text-slate-500">${head.map((h, i) => `<th class="py-1.5 px-2 font-semibold ${i ? 'text-right' : 'text-left'}">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>` +
        cons.map(r => `<tr class="border-t border-slate-700/60"><td class="py-2 px-2 font-bold" style="color:${col(r)}">${escapeHtml(getShortUnitName(r.u))}</td><td class="py-2 px-2 text-right tabular-nums">${fmtN(r.days, 0)}</td><td class="py-2 px-2 text-right tabular-nums">${fmtN(r.mwh, 0)}</td><td class="py-2 px-2 text-right tabular-nums">${r.share === null ? DASH : fmtN(r.share, 0) + '%'}</td><td class="py-2 px-2 text-right tabular-nums">${pair(r.li, r.lo, 0)}</td><td class="py-2 px-2 text-right tabular-nums">${pair(r.ei, r.eo, 1)}%</td><td class="py-2 px-2 text-right tabular-nums font-semibold ${dCls(r)}">${dTxt(r)}</td><td class="py-2 px-2 text-right tabular-nums">${fmtN(r.xth / 1000, 2)}</td><td class="py-2 px-2 text-right tabular-nums">${fmtN(r.xeur / 1000, 0)}</td></tr>`).join('') + `</tbody></table></div>`;
    const cards = `<div class="md:hidden space-y-2">` + cons.map(r => `<div class="rounded-lg border border-slate-700/60 px-3 py-2.5" style="border-left:3px solid ${col(r)}; background:${col(r)}14"><div class="flex items-baseline justify-between gap-3"><div class="font-bold text-slate-200">${escapeHtml(getShortUnitName(r.u))} <span class="text-[11px] font-normal text-slate-500">${fmtN(r.days, 0)} ${escapeHtml(t.revDays)} · ${fmtN(r.h, 0)} ${escapeHtml(t.cbHoursShort)}</span></div><div class="font-semibold tabular-nums ${dCls(r)}">${dTxt(r)} ${escapeHtml(t.revPts)}</div></div>` +
        `<div class="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 text-xs"><div><div class="text-[10px] text-slate-500">${escapeHtml(t.cbColMwh)}</div><div class="tabular-nums text-slate-200">${fmtN(r.mwh, 0)} <span class="text-slate-500">(${r.share === null ? DASH : fmtN(r.share, 0) + '%'})</span></div></div>` +
        `<div><div class="text-[10px] text-slate-500">${escapeHtml(t.cbColLoad)}</div><div class="tabular-nums text-slate-200">${pair(r.li, r.lo, 0)}</div></div>` +
        `<div><div class="text-[10px] text-slate-500">${escapeHtml(t.cbColEff)}</div><div class="tabular-nums text-slate-200">${pair(r.ei, r.eo, 1)}%</div></div>` +
        `<div><div class="text-[10px] text-slate-500">${escapeHtml(t.cbColGas)} · ${escapeHtml(t.cbColVal)}</div><div class="tabular-nums text-slate-200">${fmtN(r.xth / 1000, 2)} · ${fmtN(r.xeur / 1000, 0)}</div></div></div></div>`).join('') + `</div>`;
    table.innerHTML = desk + cards;
}

function scrollToTop() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
(function initToTop() {
    const btn = document.getElementById('toTopBtn');
    const first = document.querySelector('[role="tab"]');
    const nav = first && first.parentElement;
    if (!btn || !nav) return;
    let ticking = false;
    const update = () => {
        ticking = false;
        const show = nav.getBoundingClientRect().bottom < 0;      // τα tabs έχουν περάσει πάνω από την οθόνη
        btn.classList.toggle('opacity-0', !show);
        btn.classList.toggle('pointer-events-none', !show);
        btn.tabIndex = show ? 0 : -1;
        btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
})();
