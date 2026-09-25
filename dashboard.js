// ==========================================
// GLOBAL CHART INSTANCES & STATE
// ==========================================
let overviewChartInst = null;
let monthlyChartInst = null;
let surplusChartInst = null;
let selectorsInitialized = false;
let smartDefaultApplied = false; 

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

function initExtraSelectors() {
    const ds = document.getElementById('dateSelect');
    const ms = document.getElementById('monthSelect');
    
    if (!ds || !rawData) return;
    
    // ΕΞΥΠΝΗ ΛΟΓΙΚΗ ΕΛΕΓΧΟΥ (Smart Logic)
    if (!smartDefaultApplied && ds.options.length > 0) {
        let latestCompleteDate = null;
        
        // Σαρώνουμε τις ημερομηνίες για να δούμε ποιες ΔΕΝ έχουν SCADA
        Array.from(ds.options).forEach(opt => {
            const dateStr = opt.value;
            const scadaDay = rawData.scada ? rawData.scada.filter(d => parseDate(Object.values(d)[0]) === dateStr) : [];
            let totalScada = 0;
            
            scadaDay.forEach(d => {
                let uName = String(Object.values(d)[1]).trim();
                if (uName === "TOTAL GAS UNITS" || uName.includes("Σύνολο")) {
                    totalScada += parseNum(Object.values(d)[2]);
                }
            });

            // Αν δεν υπάρχει TOTAL GAS UNITS, τα αθροίζουμε μόνοι μας
            if (totalScada === 0 && scadaDay.length > 0) {
                scadaDay.forEach(d => {
                    let uName = String(Object.values(d)[1]).trim();
                    if (uName !== "TOTAL GAS UNITS" && !uName.includes("Σύνολο") && uName !== "NAN") {
                        totalScada += parseNum(Object.values(d)[2]);
                    }
                });
            }

            // Μαρκάρουμε τη μέρα ανάλογα με τα SCADA
            if (totalScada === 0) {
                opt.dataset.partial = 'true';
                opt.text = dateStr + ' (Pending SCADA)';
            } else {
                opt.dataset.partial = 'false';
                if (!latestCompleteDate || dateStr > latestCompleteDate) {
                    latestCompleteDate = dateStr;
                }
            }
        });

        // Αν η αρχική επιλογή του συστήματος "πέσει" σε μέρα χωρίς SCADA
        const currentOpt = ds.options[ds.selectedIndex];
        if (currentOpt && currentOpt.dataset.partial === 'true' && latestCompleteDate) {
            ds.value = latestCompleteDate;
        }

        smartDefaultApplied = true;
    }

    if (ms && ms.options.length === 0 && ds.options.length > 0) {
        const allDates = Array.from(ds.options).map(opt => opt.value);
        const months = [...new Set(allDates.map(d => d.substring(0, 7)))];
        ms.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join('');
    }
    
    updateStatusBadge();
    selectorsInitialized = true;
}

// ΕΝΗΜΕΡΩΣΗ ΤΟΥ UI BADGE
function updateStatusBadge() {
    const ds = document.getElementById('dateSelect');
    const badge = document.getElementById('dataStatusBadge');
    if (!ds || !badge) return;

    const currentOpt = ds.options[ds.selectedIndex];
    if (!currentOpt) return;

    badge.classList.remove('hidden');
    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';

    if (currentOpt.dataset.partial === 'true') {
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded border border-orange-500/50 bg-orange-500/10 text-orange-400 whitespace-nowrap transition-colors';
        badge.innerText = lang === 'el' ? '🟠 Μόνο Πρόγραμμα (ISP)' : '🟠 Pending SCADA (ISP only)';
    } else {
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 whitespace-nowrap transition-colors';
        badge.innerText = lang === 'el' ? '🟢 Πλήρη Δεδομένα' : '🟢 Complete Data';
    }
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

// ΕΞΥΠΝΗ ΑΝΤΙΣΤΟΙΧΙΣΗ (Mapping) ΟΝΟΜΑΤΩΝ
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
    if (clean.includes("PROTERGIA") || clean.includes("THESSALONIKI")) return "PROTERGIA_CC";
    if (clean.includes("HERON") || clean.includes("ΘΗΣ ΗΡΩΝ") || clean.includes("ΗΡΩΝ")) return "ΘΗΣ ΗΡΩΝ";
    if (clean.includes("MEGALOPOLI") || clean.includes("ΜΕΓΑΛΟΠΟΛΗ")) return "ΜΕΓΑΛΟΠΟΛΗ 5";
    if (clean.includes("THISVI") || clean.includes("ΘΗΣΒ")) return "ELPEDISON_THISVI";
    if (clean.includes("KORINTHOS") || clean.includes("ΚΟΡΙΝΘΟΣ")) return "KORINTHOS_POWER";
    if (clean.includes("THESS") && clean.includes("ELPEDISON")) return "ELPEDISON_THESS";
    if (clean.includes("ALIVERI") || clean.includes("ΑΛΙΒΕΡΙ")) return "ΑΛΙΒΕΡΙ 5";
    if (clean.includes("LAVRIO 5") || clean.includes("ΛΑΥΡΙΟ 5") || clean.includes("LAVRIO5")) return "ΛΑΥΡΙΟ 5";
    if (clean.includes("LAVRIO 4") || clean.includes("ΛΑΥΡΙΟ 4") || clean.includes("LAVRIO4") || clean.includes("ΛΑΥΡΙΟ") || clean.includes("LAVRIOS")) return "ΛΑΥΡΙΟ 4";
    if (clean.includes("ALOUMINIO") || clean.includes("ΑΛΟΥΜΙΝΙΟ") || clean.includes("ALUM")) return "ΑΛΟΥΜΙΝΙΟ";

    return clean;
}

// ΠΑΓΚΟΣΜΙΑ ΣΥΝΑΡΤΗΣΗ ΣΥΝΤΟΜΟΓΡΑΦΙΩΝ UI
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
function switchTab(tabId) {
    const tabs = ['overview', 'economics', 'ispScada', 'surplus'];
    
    const activeClasses = "flex items-center justify-center w-full h-full bg-blue-600 md:bg-transparent text-white md:text-blue-400 font-bold rounded-xl md:rounded-none border md:border-0 md:border-b-2 border-blue-500 md:border-blue-400 py-2.5 md:py-0 md:pb-2 px-2 transition-all whitespace-normal md:whitespace-nowrap leading-tight text-xs sm:text-sm md:text-base text-center shadow-lg md:shadow-none";
    const inactiveClasses = "flex items-center justify-center w-full h-full bg-slate-800/80 md:bg-transparent text-slate-400 md:text-slate-500 hover:bg-slate-700 md:hover:bg-transparent md:hover:text-blue-300 font-medium md:font-semibold rounded-xl md:rounded-none border md:border-0 md:border-b-2 border-slate-700 md:border-transparent py-2.5 md:py-0 md:pb-2 px-2 transition-all whitespace-normal md:whitespace-nowrap leading-tight text-xs sm:text-sm md:text-base text-center";

    tabs.forEach(t => {
        const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
        const view = document.getElementById('view' + t.charAt(0).toUpperCase() + t.slice(1));
        
        if (t === tabId) {
            btn.className = activeClasses;
            view.classList.remove('hidden');
        } else {
            btn.className = inactiveClasses;
            view.classList.add('hidden');
        }
    });

    const dateWrap = document.getElementById('dateSelectorWrapper');
    const monthWrap = document.getElementById('monthSelectorWrapper');
    
    if (tabId === 'overview' || tabId === 'economics') {
        if (dateWrap) dateWrap.classList.remove('hidden');
        if (monthWrap) monthWrap.classList.add('hidden');
    } else {
        if (dateWrap) dateWrap.classList.add('hidden');
        if (monthWrap) monthWrap.classList.remove('hidden');
    }

    if (tabId === 'overview') updateOverviewTab();
    if (tabId === 'economics') updateEconomicsTab();
    if (tabId === 'ispScada') updateMonthlyTab(); 
    if (tabId === 'surplus') updateSurplusTab(); 
}

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
    // Αφαίρεση δεκαδικών ψηφίων (0 decimal places)
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

    const colorMap = { 1: '#06b6d4', 2: '#3b82f6', 3: '#f97316' };

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
                            // Αφαίρεση δεκαδικών από το tooltip των MWh
                            label += context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ' MWh';
                            return label;
                        }
                    }
                }
            }, 
            scales: { 
                x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } }, 
                y: { grid: { color: '#334155' }, title: { display: true, text: 'MWh' } } 
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
    document.getElementById('kpiCo2').innerText = co2PriceVal > 0 ? co2PriceVal.toFixed(2) : '-';
    // Αφαίρεση δεκαδικών από τα συνολικά MWh
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

        let rowTint = "bg-[#f97316]/10 hover:bg-[#f97316]/25"; 
        let stickyTint = "bg-[#272128]"; 
        let classColor = "text-[#f97316]";

        if (meta.order === 1) { 
            rowTint = "bg-[#06b6d4]/10 hover:bg-[#06b6d4]/25"; 
            stickyTint = "bg-[#0f273b]"; 
            classColor = "text-[#06b6d4]";
        }
        
        if (meta.order === 2) { 
            rowTint = "bg-[#3b82f6]/10 hover:bg-[#3b82f6]/25"; 
            stickyTint = "bg-[#14223f]"; 
            classColor = "text-[#3b82f6]";
        }

        const unitFuelCost = u["Κόστος Καυσίμου (€)"];
        const unitEff = (unitFuelCost > 0 && hgsidaVal > 0) ? (u["Παραγωγή (MWh)"] * hgsidaVal / unitFuelCost) * 100 : 0;

        // Αφαίρεση δεκαδικών από τα παραχθέντα MWh του πίνακα
        const MWh = u["Παραγωγή (MWh)"].toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        const Eff = unitEff > 0 ? unitEff.toFixed(1) + '%' : '-';
        // Το CO2 παραμένει με 1 δεκαδικό ως ζητήθηκε "καθαρά" (μόνο για MWh)
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
            <td class="hidden sm:table-cell p-3 text-right font-mono text-emerald-400/90">${Eff}</td>
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
                        <span class="text-emerald-400 font-mono font-bold">${Eff}</span>
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
                    borderColor: '#3b82f6', 
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#3b82f6',
                    yAxisID: 'y'
                },
                { 
                    label: 'Avg Fleet SRMC', 
                    data: srmcData, 
                    borderColor: '#fbbf24', 
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    fill: true,
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#fbbf24',
                    yAxisID: 'y'
                },
                {
                    label: 'Fleet Efficiency',
                    data: effData,
                    borderColor: '#10b981', 
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5], 
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#10b981',
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
                    let hIdx = h + 1;
                    let val = parseNum(vals[hIdx]);
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

    const allDatesInMonth = [...new Set([...Object.keys(dailyConstrainedMwh), ...Object.keys(dailySurplusMap)])].sort();
    
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

    // Αφαίρεση δεκαδικών από τα συνολικά MWh στο Tab 4
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
                    backgroundColor: '#3b82f6', 
                    borderRadius: 4
                }, 
                { 
                    label: 'Generic Constraints (Out of Merit)', 
                    data: constraintsData, 
                    backgroundColor: '#f43f5e', 
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
                            // Αφαίρεση δεκαδικών από το tooltip των MWh
                            label += context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + ' MWh';
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, title: { display: true, text: 'Day of Month', color: '#64748b' } },
                y: { grid: { color: '#334155' }, title: { display: true, text: 'MWh' } }
            }
        } 
    });
}
