import os
import json
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pytz
import io
import math
import re
import time
import sys
import copy
import warnings
import traceback
from collections import defaultdict

# ==========================================
# CONFIGURATION
# ==========================================
DATA_FILE = 'data/historical.json'
META_FILE = 'data/meta.json'
# D29: το ωριαίο SCADA των τελευταίων ημερών, ΜΟΝΟ για το Python (τα οικονομικά, οι περιορισμοί). Η σελίδα δεν το κατεβάζει.
HOURLY_FILE = 'data/scada_hourly.json'
KEEP_HOURLY_DAYS = 14
ADMIE_API_URL = "https://www.admie.gr/getOperationMarketFile"
TZ = pytz.timezone('Europe/Athens')
# Τα αρχεία xlsx του ΑΔΜΗΕ δεν έχουν προεπιλεγμένο στυλ και το openpyxl το γράφει σε κάθε αρχείο· αβλαβές, κρύβεται ΜΟΝΟ αυτό το μήνυμα.
warnings.filterwarnings("ignore", message="Workbook contains no default style", category=UserWarning)

# Ώρες των εξωτερικών εκτελέσεων (cron-job.org, ώρα Ελλάδος): πρωί μετά τη δημοσίευση του SCADA (~06:05)
# και μεσημέρι μετά τη δημοσίευση του HGSIDA. Είναι η ΜΟΝΗ πηγή για το «Επόμενη ενημέρωση» της σελίδας.
# Αν αλλάξουν τα jobs στο cron-job.org, αλλάζει και αυτή η λίστα (docs/DECISIONS.md, D07).
UPDATE_SCHEDULE = ["07:06", "13:00"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Cache-Control": "no-cache"
}

# ΜΗΤΡΩΟ ΤΕΧΝΙΚΩΝ ΧΑΡΑΚΤΗΡΙΣΤΙΚΩΝ ΜΟΝΑΔΩΝ Φ.Α. (Min/Max, Εύρος Απόδοσης, Εύρος CO2)
# Επικαιροποιημένο βάσει δεδομένων ENTSO-E / ADMIE 2026
PLANT_SPECS = {
    "AG_NIKOLAOS2": {"p_min": 295, "p_max": 803, "eff_min": 0.505, "eff_max": 0.635, "co2_min": 0.38, "co2_max": 0.33},
    "KOMOTINI_POWER": {"p_min": 295, "p_max": 858, "eff_min": 0.500, "eff_max": 0.630, "co2_min": 0.38, "co2_max": 0.33},
    "PROTERGIA_CC": {"p_min": 160, "p_max": 432.7, "eff_min": 0.440, "eff_max": 0.585, "co2_min": 0.43, "co2_max": 0.36},
    "KORINTHOS_POWER": {"p_min": 182, "p_max": 433.4, "eff_min": 0.435, "eff_max": 0.580, "co2_min": 0.44, "co2_max": 0.37},
    "ELPEDISON_THISVI": {"p_min": 230, "p_max": 410, "eff_min": 0.430, "eff_max": 0.570, "co2_min": 0.44, "co2_max": 0.37},
    "ELPEDISON_THESS": {"p_min": 220, "p_max": 400, "eff_min": 0.425, "eff_max": 0.565, "co2_min": 0.45, "co2_max": 0.38},
    "ΘΗΣ ΗΡΩΝ": {"p_min": 210, "p_max": 422, "eff_min": 0.430, "eff_max": 0.575, "co2_min": 0.44, "co2_max": 0.37},
    "ΑΛΙΒΕΡΙ 5": {"p_min": 200, "p_max": 417, "eff_min": 0.430, "eff_max": 0.575, "co2_min": 0.44, "co2_max": 0.37},
    "ΛΑΥΡΙΟ 5": {"p_min": 180, "p_max": 378, "eff_min": 0.420, "eff_max": 0.560, "co2_min": 0.45, "co2_max": 0.38},
    "ΜΕΓΑΛΟΠΟΛΗ 5": {"p_min": 250, "p_max": 811, "eff_min": 0.435, "eff_max": 0.570, "co2_min": 0.44, "co2_max": 0.37},
    "ΚΟΜΟΤΗΝΗ": {"p_min": 240, "p_max": 472, "eff_min": 0.400, "eff_max": 0.525, "co2_min": 0.48, "co2_max": 0.41},
    "ΑΛΟΥΜΙΝΙΟ": {"p_min": 128, "p_max": 334, "eff_min": 0.480, "eff_max": 0.550, "co2_min": 0.40, "co2_max": 0.38},
    "ΛΑΥΡΙΟ 4": {"p_min": 150, "p_max": 536, "eff_min": 0.420, "eff_max": 0.520, "co2_min": 0.48, "co2_max": 0.39}
}

# ==========================================
# INITIALIZE DATABASE
# ==========================================
if os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        try:
            db = json.load(f)
        except json.JSONDecodeError:
            db = {}
else:
    db = {}

keys = ["isp_generation", "scada_generation", 
        "henex_indices", "thermal_efficiency", 
        "daily_surplus", "daily_gas_constraints", "co2_prices", "daily_economics",
        "daily_constrained_mwh", "scada_quality"]
for k in keys:
    if k not in db:
        db[k] = []

def load_hourly():
    """Ωριαίο SCADA για το Python (τελευταίες KEEP_HOURLY_DAYS ημέρες). Αν το αρχείο δεν υπάρχει, χτίζεται από το ωριαίο SCADA
    που ίσως ακόμα έχει το historical.json (μετάβαση του D29· μετά το D30 το κλειδί αυτό διαγράφεται)."""
    if os.path.exists(HOURLY_FILE):
        try:
            with open(HOURLY_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass
        print(f"⚠ Το {HOURLY_FILE} δεν διαβάστηκε· ξαναχτίζεται από το {DATA_FILE}.")
    return [copy.deepcopy(r) for r in db.get("scada_generation_hourly", [])]

hourly = load_hourly()

# Μία μέρα που αποτυγχάνει δεν σταματά τις άλλες (D29). Στο τέλος, αν υπάρχουν αποτυχίες, το script γράφει όσα πέτυχαν και βγαίνει με κωδικό 1.
FAILURES = []

def note_failure(date_str, step, exc):
    FAILURES.append((date_str, step, f"{type(exc).__name__}: {exc}"))
    print(f"  [{date_str}] ✗ ΣΦΑΛΜΑ στο βήμα «{step}»: {type(exc).__name__}: {exc}")
    traceback.print_exc()

# ==========================================
# HELPER FUNCTIONS
# ==========================================
def get_admie_excel_url(date_str, file_category):
    url = f"{ADMIE_API_URL}?dateStart={date_str}&dateEnd={date_str}&FileCategory={file_category}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200 and "error" not in resp.text.lower():
            data = resp.json()
            for item in data:
                path = item.get("file_path", "")
                if ".xls" in path.lower():
                    return f"https://www.admie.gr{path}" if path.startswith("/") else path
    except Exception as e:
        print(f"  [{date_str}] ⚠ Η λίστα αρχείων του ΑΔΜΗΕ ({file_category}) δεν διαβάστηκε: {type(e).__name__}: {e}")
    return None

def fetch_excel(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        if resp.status_code == 200:
            return io.BytesIO(resp.content)
        print(f"  ⚠ Λήψη αρχείου: HTTP {resp.status_code} -- {url}")
    except Exception as e:
        print(f"  ⚠ Λήψη αρχείου απέτυχε ({type(e).__name__}: {e}) -- {url}")
    return None

# ==========================================
# PROCESSORS (ADMIE & HENEX & CO2)
# ==========================================
def hours_in_day(date_str):
    """Πόσες ώρες έχει η συγκεκριμένη ημερολογιακή μέρα στην Ελλάδα: 24, ή 25 (τέλος Οκτωβρίου), ή 23 (τέλος Μαρτίου).
    Το template του ΑΔΜΗΕ έχει ΠΑΝΤΑ 25 στήλες ωρών (από τον Ιούνιο 2026), με την 25η μηδενική σε μέρα 24 ωρών,
    άρα ο αριθμός των ωρών δεν βγαίνει από την επικεφαλίδα· βγαίνει από το ημερολόγιο."""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    nxt = d + timedelta(days=1)
    start = TZ.localize(datetime(d.year, d.month, d.day))
    end = TZ.localize(datetime(nxt.year, nxt.month, nxt.day))
    return int(round((end - start).total_seconds() / 3600))

def find_hour_columns(df):
    """Βρίσκει από την επικεφαλίδα του sheet (γραμμή με τους αριθμούς 1…N και μετά τη λέξη SUM) ποιες στήλες είναι ώρες.
    Επιστρέφει (λίστα στηλών ωρών, στήλη SUM) ή ([], None) αν δεν βρεθεί επικεφαλίδα με συνεχόμενη αρίθμηση 1…N."""
    for i in range(min(15, len(df))):
        row = df.iloc[i].tolist()
        for j, v in enumerate(row):
            if j >= 3 and str(v).strip().upper() == "SUM":
                cols = list(range(2, j))
                nums = [pd.to_numeric(str(row[c]).strip(), errors='coerce') for c in cols]
                if cols and all(pd.notna(n) for n in nums) and [int(n) for n in nums] == list(range(1, len(cols) + 1)):
                    return cols, j
    return [], None

def process_scada(date_str):
    url = get_admie_excel_url(date_str, "SystemRealizationSCADA")
    if not url: return
    excel_data = fetch_excel(url)
    if not excel_data: return
    try:
        xl = pd.ExcelFile(excel_data)
        target_sheet = "System_Production" if "System_Production" in xl.sheet_names else xl.sheet_names[0]
        df = xl.parse(target_sheet, header=None)
        
        # 1. ΚΑΘΑΡΙΣΜΟΣ ΠΑΛΙΩΝ ΔΕΔΟΜΕΝΩΝ (Απόλυτο Wipe για τη συγκεκριμένη μέρα για 100% καθαρό backfill)
        db["scada_generation"] = [d for d in db["scada_generation"] if d.get("Ημερομηνία") != date_str]
        hourly[:] = [d for d in hourly if d.get("Ημερομηνία") != date_str]
        db["scada_quality"] = [d for d in db["scada_quality"] if d.get("Ημερομηνία") != date_str]
        
        # Λεξικό για την αποθήκευση μοναδικών εγγραφών ανά μονάδα
        daily_units_data = {} 
        
        # Στήλες ωρών: οι πρώτες N της επικεφαλίδας (01 … και μετά SUM), όπου N = οι ώρες της ημέρας στην Ελλάδα
        # (24, ή 25 στο τέλος Οκτωβρίου, ή 23 στο τέλος Μαρτίου). Το SUM δεν διαβάζεται ποτέ ως ώρα (D17).
        header_cols, sum_col = find_hour_columns(df)
        n_hours = hours_in_day(date_str)
        if not header_cols:
            print(f"  [{date_str}] SCADA: δεν βρέθηκε επικεφαλίδα ωρών (1…N, SUM) -- χρησιμοποιούνται 24 ώρες.")
            hour_cols, sum_col, n_hours = list(range(2, 26)), None, 24
        else:
            if n_hours > len(header_cols):
                print(f"  [{date_str}] SCADA: η μέρα έχει {n_hours} ώρες αλλά η επικεφαλίδα μόνο {len(header_cols)} στήλες ωρών.")
                n_hours = len(header_cols)
            hour_cols = header_cols[:n_hours]
        if n_hours != 24:
            print(f"  [{date_str}] SCADA: {n_hours} ώρες (μέρα αλλαγής ώρας).")

        def to_num(v):
            val = pd.to_numeric(str(v).replace(' ', '').replace(',', '.'), errors='coerce')
            return 0.0 if pd.isna(val) else float(val)

        def is_blank(v):
            return bool(pd.isna(pd.to_numeric(str(v).replace(' ', '').replace(',', '.'), errors='coerce')))

        blanks = {}   # μονάδα -> ώρες (1…N) με κενό ή μη αριθμητικό κελί: αποθηκεύονται ως 0.0, αλλά καταγράφονται (K13, D29)

        def extract_hourly_data(row, unit_name):
            vals = []
            for k, j in enumerate(hour_cols, 1):
                if j < len(row) and not is_blank(row.iloc[j]):
                    vals.append(to_num(row.iloc[j]))
                else:
                    vals.append(0.0)
                    blanks.setdefault(unit_name, set()).add(k)
            return vals

        def extract_file_sum(row):
            return to_num(row.iloc[sum_col]) if (sum_col is not None and sum_col < len(row)) else None

        file_sums = {}   # άθροισμα ανά μονάδα όπως το γράφει το ίδιο το αρχείο (στήλη SUM), για έλεγχο

        # 2. Σάρωση για Μονάδες Φυσικού Αερίου (Κλασικό μπλοκ)
        start_mask = df[1].astype(str).str.contains("ΜΟΝΑΔΕΣ Φ. ΑΕΡΙΟΥ|ΜΟΝΑΔΕΣ ΦΥΣΙΚΟΥ ΑΕΡΙΟΥ", case=False, na=False)
        if start_mask.any():
            start_idx = df[start_mask].index[0]
            end_mask = df[1].astype(str).str.contains("TOTAL GAS|ΥΔΡΟΗΛΕΚΤΡΙΚΕΣ|ΣΥΜΠΑΡΑΓΩΓΗ", case=False, na=False)
            end_idx_matches = df.iloc[start_idx+1:][end_mask.iloc[start_idx+1:]].index
            end_idx = end_idx_matches[0] if len(end_idx_matches) > 0 else len(df)
            
            for _, row in df.iloc[start_idx+1:end_idx].iterrows():
                raw_name = str(row[1]).strip()
                if not raw_name or raw_name.lower() == 'nan': continue
                if "TOTAL" in raw_name.upper() or "ΣΥΝΟΛΟ" in raw_name.upper(): continue
                
                unit_name = re.sub(r'\s*\((ST|GT\d+)\)', '', raw_name, flags=re.IGNORECASE).strip()
                hourly_vals = extract_hourly_data(row, unit_name)
                fs = extract_file_sum(row)
                if fs is not None: file_sums[unit_name] = file_sums.get(unit_name, 0.0) + fs
                
                # Deduplication: Αν υπάρχει ήδη, αθροίζουμε.
                if unit_name in daily_units_data:
                    daily_units_data[unit_name] = [sum(x) for x in zip(daily_units_data[unit_name], hourly_vals)]
                else:
                    daily_units_data[unit_name] = hourly_vals

        # 3. Σάρωση ΕΙΔΙΚΑ για το Αλουμίνιο στη Συμπαραγωγή
        alouminio_mask = df[1].astype(str).str.contains("ΑΛΟΥΜΙΝΙΟ|ALUMINIUM|MYTILIN|METLEN", case=False, na=False)
        chp_mask = df[1].astype(str).str.contains("ΣΥΜΠΑΡΑΓΩΓΗ|CHP", case=False, na=False)
        
        if chp_mask.any() and alouminio_mask.any():
            chp_idx = chp_mask.index[0]
            valid_alouminio = df.iloc[chp_idx:][alouminio_mask]
            
            for _, row in valid_alouminio.iterrows():
                 raw_name = str(row[1]).strip()
                 if "TOTAL" in raw_name.upper() or "ΣΥΝΟΛΟ" in raw_name.upper(): continue
                 
                 unit_name = "ΑΛΟΥΜΙΝΙΟ"
                 hourly_vals = extract_hourly_data(row, unit_name)
                 fs = extract_file_sum(row)
                 if fs is not None: file_sums[unit_name] = file_sums.get(unit_name, 0.0) + fs
                 
                 if unit_name in daily_units_data:
                     daily_units_data[unit_name] = [sum(x) for x in zip(daily_units_data[unit_name], hourly_vals)]
                 else:
                     daily_units_data[unit_name] = hourly_vals

        # 4. Εγγραφή των καθαρών, μοναδικών δεδομένων
        if not daily_units_data: return
        
        total_gas = 0.0
        mismatches = []
        for unit_name, hourly_vals in daily_units_data.items():
            daily_sum = float(round(sum(hourly_vals), 3))
            total_gas += daily_sum
            # Αυστηρή ανάγνωση: το άθροισμα των ωρών πρέπει να ισούται με τη στήλη SUM του ίδιου του αρχείου
            if unit_name in file_sums and abs(daily_sum - file_sums[unit_name]) > 1.0:
                mismatches.append(f"{unit_name}: ώρες={daily_sum:.0f} SUM={file_sums[unit_name]:.0f}")
            
            db["scada_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name, "Παραγωγή SCADA (MWh)": daily_sum})
            
            hourly_record = {"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name}
            for h in range(1, n_hours + 1):
                hourly_record[f"{h:02d}:00"] = hourly_vals[h-1]
            hourly_record["Ημερήσιο Σύνολο"] = daily_sum
            hourly.append(hourly_record)
        for unit_name, hrs in sorted(blanks.items()):
            db["scada_quality"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name, "Ώρες": sorted(hrs)})
        if blanks:
            print(f"  [{date_str}] ⚠ SCADA: κενά ή μη αριθμητικά κελιά ωρών (γράφονται ως 0.0): " + "; ".join(f"{u}: ώρες {sorted(h)}" for u, h in sorted(blanks.items())))
        if mismatches:
            print(f"  [{date_str}] ⚠ SCADA: το άθροισμα των ωρών διαφέρει από τη στήλη SUM του αρχείου -> " + "; ".join(mismatches))
            
        # Εγγραφή TOTAL 
        if total_gas > 0:
            db["scada_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": "TOTAL GAS UNITS", "Παραγωγή SCADA (MWh)": float(round(total_gas, 3))})
            
    except Exception as e:
        print(f"Error parsing SCADA for {date_str}: {e}")
        raise

# ==========================================
# GENERIC CONSTRAINTS (από το τελευταίο sheet του ISP2)
# ==========================================
# Λίστα ΕΠΙΤΡΕΠΟΜΕΝΩΝ μονάδων Φ.Α. (όχι λίστα αποκλεισμών): το sheet περιέχει και λιγνίτη/υδροηλεκτρικά.
CONSTRAINT_GAS_PREFIXES = ("ALIVERI", "HERON", "PROTERGIA", "KORINTHOS", "ELPEDISON", "KOMOTINI",
                           "LAVRIO", "MEGALOPOLI_V", "AG_NIKOLAOS", "THESSALONIKI", "THISVI")
# Γνωστές μονάδες που εξαιρούνται ΠΑΝΤΑ (δεν τυπώνονται στο log ως "άγνωστες"):
# ALOUMINIO = συμπαραγωγή με κλειδωμένη παραγωγή 24/7, PTOLEMAIDA = λιγνίτης, AGRAS = μεγάλο υδροηλεκτρικό.
CONSTRAINT_KNOWN_EXCLUDED = ("ALOUMINIO", "PTOLEMAIDA", "AGRAS")

def is_gas_constraint_unit(unit):
    return str(unit).strip().upper().startswith(CONSTRAINT_GAS_PREFIXES)

def extract_constraints(xl, date_str):
    """Γράφει στο daily_gas_constraints μία γραμμή ανά (μέρα, μονάδα Φ.Α., παράθυρο). Το ISP δίνει ΜΟΝΟ
    μονάδες και ώρες· τα MWh υπολογίζονται στο dashboard από τα ωριαία SCADA."""
    sheet = next((s for s in xl.sheet_names if str(s).upper().endswith("GENERICCONSTRAINTS")), None)
    if not sheet:
        return
    df = xl.parse(sheet, header=None)
    hdr_idx = None
    for i in range(min(6, len(df))):
        vals = [str(v).strip() for v in df.iloc[i].tolist()]
        if "Unit" in vals and "Start Time" in vals and "End Time" in vals:
            hdr_idx = i
            break
    if hdr_idx is None:
        print(f"  [{date_str}] Constraints: δεν βρέθηκε header στο sheet '{sheet}'.")
        return
    body = df.iloc[hdr_idx + 1:].copy()
    body.columns = [str(v).strip() for v in df.iloc[hdr_idx].tolist()]

    day_start = pd.Timestamp(date_str)
    day_end = day_start + pd.Timedelta(days=1)
    seen, unknown_skipped = set(), set()
    for _, r in body.iterrows():
        unit = str(r["Unit"]).strip()
        if not unit or unit.lower() == "nan":
            continue
        if not is_gas_constraint_unit(unit):
            if not unit.upper().startswith(CONSTRAINT_KNOWN_EXCLUDED):
                unknown_skipped.add(unit)
            continue
        start = pd.to_datetime(r["Start Time"], errors="coerce")
        end = pd.to_datetime(r["End Time"], errors="coerce")
        if pd.isna(start) or pd.isna(end):
            continue
        start, end = max(start, day_start), min(end, day_end)   # κόβουμε στα όρια της μέρας
        if end <= start:
            continue
        h_from = start.strftime("%H:%M")
        h_to = "24:00" if end >= day_end else end.strftime("%H:%M")
        key = (unit, h_from, h_to)
        if key in seen:
            continue
        seen.add(key)
        db["daily_gas_constraints"].append({"Date": date_str, "Gas Factory": unit, "Hour From": h_from, "Hour To": h_to})
    if unknown_skipped:
        print(f"  [{date_str}] Constraints: μονάδες εκτός λίστας Φ.Α. (έλεγξε αν χρειάζεται να προστεθούν): {sorted(unknown_skipped)}")
    print(f"  [{date_str}] Constraints: {len(seen)} γραμμές Φ.Α.")

def find_isp_quarter_columns(df, header_idx, date_str):
    """Στήλες των τετάρτων (15λεπτων) του ISP από την επικεφαλίδα του μπλοκ «Thermal Units».
    Στο αρχείο οι τιμές των τετάρτων είναι στις στήλες 1…N και η στήλη «TOTAL» ακολουθεί αμέσως μετά (N = 96 σε κανονική μέρα,
    100 σε μέρα 25 ωρών, 92 σε μέρα 23 ωρών). Το N προκύπτει από το ημερολόγιο (hours_in_day × 4), όχι από σταθερά.
    Επιστρέφει (λίστα στηλών τετάρτων, στήλη TOTAL ή None)."""
    hdr = [str(v).strip() for v in df.iloc[header_idx].tolist()]
    tcol = next((i for i, v in enumerate(hdr) if i >= 1 and v.upper() == "TOTAL"), None)
    n_expected = hours_in_day(date_str) * 4
    if tcol is None:
        print(f"  [{date_str}] ISP: δεν βρέθηκε στήλη TOTAL στην επικεφαλίδα -- διαβάζονται {n_expected} τέταρτα χωρίς έλεγχο.")
        return list(range(1, 1 + n_expected)), None
    n_file = tcol - 1
    n = n_expected
    if n_file != n_expected:
        print(f"  [{date_str}] ISP: η μέρα έχει {n_expected} τέταρτα αλλά το αρχείο {n_file}.")
        n = min(n_file, n_expected)
    if n != 96:
        print(f"  [{date_str}] ISP: {n} τέταρτα (μέρα αλλαγής ώρας).")
    return list(range(1, 1 + n)), tcol

def process_isp(date_str):
    url = get_admie_excel_url(date_str, "ISP2ISPResults")
    if not url: return
    excel_data = fetch_excel(url)
    if not excel_data: return
    try:
        xl = pd.ExcelFile(excel_data)
        try:
            extract_constraints(xl, date_str)
        except Exception as e:
            note_failure(date_str, "constraints", e)
        target_sheet = xl.sheet_names[0]
        for s in xl.sheet_names:
            if str(s).upper().endswith("_ISP"):
                target_sheet = s
                break
        df = xl.parse(target_sheet, header=None)
        if not any(d.get("Date") == date_str for d in db["daily_surplus"]):
            total_col = None
            for c in df.columns:
                if df.iloc[:10, c].astype(str).str.contains("TOTAL|ΣΥΝΟΛΟ", case=False, na=False).any():
                    total_col = c
                    break
            if total_col is not None:
                mask0 = df[0].astype(str).str.contains("ENERGY SURPLUS|ΠΛΕΟΝΑΣΜΑ|DEFICIT|ΕΛΛΕΙΜΜΑ", case=False, na=False)
                mask1 = df[1].astype(str).str.contains("ENERGY SURPLUS|ΠΛΕΟΝΑΣΜΑ|DEFICIT|ΕΛΛΕΙΜΜΑ", case=False, na=False)
                surplus_mask = mask0 | mask1
                if surplus_mask.any():
                    val = pd.to_numeric(str(df[surplus_mask].iloc[0][total_col]).replace(' ', '').replace(',', '.'), errors='coerce')
                    if not pd.isna(val):
                        db["daily_surplus"].append({"Date": date_str, "Total Daily Surplus (MWh)": float(round(abs(val), 3))})
        
        if not any(d.get("Ημερομηνία") == date_str for d in db["isp_generation"]):
            thermal_mask = df[0].astype(str).str.strip().str.lower() == "thermal units"
            if thermal_mask.any():
                thermal_indices = df[thermal_mask].index.tolist()
                start_idx = thermal_indices[-1]
                end_mask = df[0].astype(str).str.contains("Total |Hydro |RES |Energy |Pumping", case=False, na=False)
                end_idx_matches = df.iloc[start_idx+1:][end_mask.iloc[start_idx+1:]].index
                end_idx = end_idx_matches[0] if len(end_idx_matches) > 0 else len(df)
                gas_df = df.iloc[start_idx+1:end_idx].copy().dropna(subset=[0])
                q_cols, t_col = find_isp_quarter_columns(df, start_idx, date_str)
                total_isp = 0.0
                mismatches = []
                for _, row in gas_df.iterrows():
                    unit = str(row[0]).strip()
                    if not unit or unit.lower() == 'nan': continue
                    if any(l in unit.upper() for l in ["AG_DIMITRIOS", "PTOLEMAIDA", "MEGALOPOLI4", "MEGALOPOLI3", "MELITI", "AGIOS DIMITRIOS"]): continue
                    # D18: τα τέταρτα 1…N (N από το ημερολόγιο). Η παλιά ανάγνωση iloc[2:98] έχανε το 1ο τέταρτο και,
                    # σε κανονική μέρα, πρόσθετε και τη στήλη TOTAL ως 97ο τέταρτο (+23-24%)· σε μέρα 25 ωρών έχανε 1 ώρα.
                    vals = pd.to_numeric(row.iloc[q_cols].astype(str).str.replace(' ', '').str.replace(',', '.'), errors='coerce')
                    daily_mwh = float(round(vals.sum() / 4, 3))
                    if t_col is not None:   # έλεγχος με το σύνολο που γράφει το ίδιο το αρχείο
                        ft = pd.to_numeric(str(row.iloc[t_col]).replace(' ', '').replace(',', '.'), errors='coerce')
                        if not pd.isna(ft) and abs(daily_mwh - float(ft)) > 1.0:
                            mismatches.append(f"{unit}: τέταρτα={daily_mwh:.0f} TOTAL={float(ft):.0f}")
                    total_isp += daily_mwh
                    db["isp_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit, "Παραγωγή (MWh)": daily_mwh})
                if mismatches:
                    print(f"  [{date_str}] ⚠ ISP: το άθροισμα των τετάρτων διαφέρει από τη στήλη TOTAL του αρχείου -> " + "; ".join(mismatches))
                if total_isp > 0:
                    db["isp_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": "TOTAL GAS UNITS", "Παραγωγή (MWh)": float(round(total_isp, 3))})
    except Exception as e:
        print(f"Error parsing ISP for {date_str}: {e}")
        raise

def process_henex(date_str):
    if any(d.get("Ημερομηνία") == date_str for d in db["henex_indices"]): return
    date_for_url = date_str.replace("-", "")
    for v in range(1, 4):
        url = f"https://www.enexgroup.gr/documents/20126/997118/{date_for_url}_NGAS_DOL_EN_v{v:02d}.xlsx"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                df = pd.read_excel(io.BytesIO(resp.content), sheet_name=0, header=None)
                header_mask = df.apply(lambda r: r.astype(str).str.contains("Contract", case=False).any(), axis=1)
                if not header_mask.any(): continue
                header_idx = df[header_mask].index[0]
                df.columns = df.iloc[header_idx]
                df = df.iloc[header_idx+1:]
                hgsida = hgsiwd = hgmbi = hgmsi = 0.0
                found_da = False
                for _, row in df.iterrows():
                    contract = str(row.get("Contract", "")).strip()
                    if contract == "DA":
                        hgsida = pd.to_numeric(str(row.get("HGSIDA", 0)).replace(',', '.'), errors='coerce')
                        if pd.notna(hgsida) and hgsida > 0:
                            found_da = True
                    elif contract == "WD":
                        hgsiwd = pd.to_numeric(str(row.get("HGSIWD", 0)).replace(',', '.'), errors='coerce')
                        hgmbi = pd.to_numeric(str(row.get("HGMBI", 0)).replace(',', '.'), errors='coerce')
                        hgmsi = pd.to_numeric(str(row.get("HGMSI", 0)).replace(',', '.'), errors='coerce')
                # ΔΙΟΡΘΩΣΗ: το ΗΕνΕξ δημοσιεύει μερικές φορές πρώτα ένα "άδειο" αρχείο (μόνο headers,
                # καμία γραμμή DA) πριν συμπληρωθούν τα πραγματικά δεδομένα -- πριν, αυτό γραφόταν σαν
                # επιτυχία με HGSIDA=0.0 και η συνάρτηση δεν ξαναδοκίμαζε τις επόμενες εκδόσεις (v02/v03).
                # Τώρα: δεχόμαστε την εγγραφή ΜΟΝΟ αν βρέθηκε πραγματική γραμμή DA με τιμή > 0.
                if found_da:
                    db["henex_indices"].append({
                        "Ημερομηνία": date_str,
                        "HGSIDA (€/MWh)": float(hgsida),
                        "HGSIWD (€/MWh)": 0.0 if pd.isna(hgsiwd) else float(hgsiwd),
                        "HGMBI (€/MWh)": 0.0 if pd.isna(hgmbi) else float(hgmbi),
                        "HGMSI (€/MWh)": 0.0 if pd.isna(hgmsi) else float(hgmsi)
                    })
                    break
                # αλλιώς: συνεχίζουμε στην επόμενη έκδοση (v02/v03) αντί να κάνουμε break σε κενό αρχείο
        except Exception as e:
            print(f"  [{date_str}] ⚠ HEnEx v{v:02d}: {type(e).__name__}: {e}")

def process_co2(date_str):
    # Δεν κάνει πλέον κλήση API εδώ (βλ. fetch_latest_co2_price). Μόνο εκκαθαρίζει τυχόν
    # ορφανή εγγραφή None, ώστε το process_economics να πέσει καθαρά στο fallback 85.00/estimated.
    for c in db["co2_prices"]:
        if c.get("Ημερομηνία") == date_str and c.get("CO2_Price (€/t)") is not None:
            return
    db["co2_prices"] = [d for d in db["co2_prices"] if d.get("Ημερομηνία") != date_str]

def fetch_latest_co2_price(today_str):
    """Καλείται ΜΙΑ φορά ανά εκτέλεση, ΜΟΝΟ από το καθημερινό cron (ποτέ σε manual backfill).
    Χρησιμοποιεί το ΤΕΚΜΗΡΙΩΜΕΝΟ /v1/prices/latest (1 request), όχι το /v1/prices?by_date που
    δεν τεκμηριώνεται επίσημα και προκαλούσε μετατόπιση ημερομηνίας. Το /latest δεν δέχεται
    ημερομηνία -- η τιμή που επιστρέφει ανατίθεται στη ΣΗΜΕΡΙΝΗ μέρα ως γνωστή απλοποίηση
    (ίδιας λογικής με το "Pending SCADA"): μπορεί να αντανακλά το πιο πρόσφατο κλείσιμο αν η
    αγορά δεν έχει κλείσει ακόμα σήμερα."""
    for c in db["co2_prices"]:
        if c.get("Ημερομηνία") == today_str and c.get("CO2_Price (€/t)") is not None:
            print(f"  [{today_str}] CO2 Price already exists. Skipping API call.")
            return

    db["co2_prices"] = [d for d in db["co2_prices"] if d.get("Ημερομηνία") != today_str]

    # ΣΑΒΒΑΤΟΚΥΡΙΑΚΟ: η αγορά EUA είναι κλειστή, δεν έχει νόημα να ζητήσουμε API (γλιτώνουμε calls).
    # Κουβαλάμε την τελευταία ΠΡΑΓΜΑΤΙΚΗ τιμή (Estimated:false) -- ΠΟΤΕ μια ήδη-εκτιμημένη τιμή,
    # για να μη "χτίζεται" σφάλμα πάνω σε σφάλμα -- σημειωμένη ως estimated.
    if datetime.strptime(today_str, "%Y-%m-%d").weekday() >= 5:
        last_real = sorted(
            [c for c in db["co2_prices"] if c.get("Ημερομηνία") < today_str
             and c.get("CO2_Price (€/t)") is not None and c.get("Estimated") is False],
            key=lambda c: c["Ημερομηνία"]
        )
        if last_real:
            src = last_real[-1]
            db["co2_prices"].append({"Ημερομηνία": today_str, "CO2_Price (€/t)": src["CO2_Price (€/t)"], "Estimated": True})
            print(f"  [{today_str}] Σαββατοκύριακο -- κρατάμε την τιμή της {src['Ημερομηνία']} ({src['CO2_Price (€/t)']}) ως estimated. Καμία κλήση API.")
        else:
            db["co2_prices"].append({"Ημερομηνία": today_str, "CO2_Price (€/t)": None})
            print(f"  [{today_str}] Σαββατοκύριακο, καμία προηγούμενη πραγματική τιμή για forward-fill.")
        return

    api_key = os.environ.get('OILPRICE_API_KEY')
    if not api_key: return

    url = "https://api.oilpriceapi.com/v1/prices/latest"
    headers = {"Authorization": f"Token {api_key}", "Content-Type": "application/json"}
    params = {"by_code": "EU_CARBON_EUR"}

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            price = data.get("data", {}).get("price") if data.get("status") == "success" else None
            if price is not None:
                db["co2_prices"].append({"Ημερομηνία": today_str, "CO2_Price (€/t)": float(price), "Estimated": False})
                print(f"  [{today_str}] Fetched latest CO2 price from API: {price}")
            else:
                db["co2_prices"].append({"Ημερομηνία": today_str, "CO2_Price (€/t)": None})
        else:
            db["co2_prices"].append({"Ημερομηνία": today_str, "CO2_Price (€/t)": None})
    except Exception as e:
        # ΔΙΟΡΘΩΣΗ: πριν, ένα exception εδώ άφηνε τη μέρα ΧΩΡΙΣ ΚΑΜΙΑ εγγραφή -- η μέρα "χανόταν"
        # σιωπηλά, χωρίς καν το ρητό None που θα την έδειχνε ως δοκιμασμένη-αλλά-αποτυχημένη.
        db["co2_prices"].append({"Ημερομηνία": today_str, "CO2_Price (€/t)": None})
        print(f"  [{today_str}] CO2 API error: {e}")

# ==========================================
# PROCESSOR (ADVANCED ECONOMICS ENGINE)
# ==========================================
def process_economics(date_str):
    db["daily_economics"] = [d for d in db["daily_economics"] if d.get("Ημερομηνία") != date_str]

    # Το ΗΕνΕξ δημοσιεύει το HGSIDA αργότερα μέσα στη μέρα (το πρωινό run στις 07:00 συνήθως
    # προλαβαίνει πριν βγει) -- αν δεν υπάρχει ΑΚΟΜΑ γνήσια εγγραφή, δεν γράφουμε economics
    # καθόλου για σήμερα, αντί να προχωράμε με fallback 50.0 και να παράγουμε μισό-σωστή
    # εγγραφή κόστους. Το dashboard ήδη δείχνει σωστά "δεν υπάρχουν ακόμα δεδομένα" όταν λείπει
    # η εγγραφή -- το μεσημεριανό run θα τη γράψει πλήρη μόλις βγει το ΗΕνΕξ.
    henex_entry = next((h for h in db["henex_indices"] if h.get("Ημερομηνία") == date_str), None)
    hgsida_val = henex_entry.get("HGSIDA (€/MWh)", 0.0) if henex_entry else 0.0
    # Δίχτυ ασφαλείας: ΟΥΤΕ το HGSIDA μπορεί γνήσια να είναι 0 (ποτέ δεν συμβαίνει στην πράξη) --
    # αν η εγγραφή λείπει Η ΕΧΕΙ 0, θεωρούμε ότι το ΗΕνΕξ δεν έχει δημοσιεύσει ακόμα.
    if henex_entry is None or hgsida_val <= 0:
        print(f"  [{date_str}] HGSIDA δεν έχει δημοσιευτεί ακόμα -- economics αναβάλλονται για το επόμενο run.")
        return

    co2_val = 85.0  # fallback
    co2_estimated = True
    for c in db["co2_prices"]:
        if c.get("Ημερομηνία") == date_str:
            p = c.get("CO2_Price (€/t)")
            if p is not None:
                co2_val = p
                co2_estimated = bool(c.get("Estimated", False))
            break

    hourly_records = [r for r in hourly if r.get("Ημερομηνία") == date_str]
    if not hourly_records: return

    units_summary = []
    fleet_total_mwh = 0.0
    fleet_total_fuel_cost = 0.0
    fleet_total_co2_cost = 0.0
    fleet_total_tons = 0.0

    for rec in hourly_records:
        unit_name = rec.get("Μονάδα Φ.Α.")
        if unit_name == "TOTAL GAS UNITS": continue

        specs = PLANT_SPECS.get(unit_name, {"p_min": 150, "p_max": 500, "eff_min": 0.43, "eff_max": 0.57, "co2_min": 0.44, "co2_max": 0.37})
        
        p_min = specs["p_min"]
        p_max = specs["p_max"]
        eff_min = specs["eff_min"]
        eff_max = specs["eff_max"]
        co2_min = specs["co2_min"]
        co2_max = specs["co2_max"]

        unit_mwh = 0.0
        unit_fuel_cost = 0.0
        unit_co2_cost = 0.0
        unit_tons = 0.0

        # όλες οι ώρες που έχει η εγγραφή (23, 24 ή 25 σε μέρες αλλαγής ώρας)
        for hour_key in sorted(k for k in rec if re.fullmatch(r"\d{2}:00", k)):
            p_hour = rec.get(hour_key, 0.0)
            if p_hour <= 0: continue

            unit_mwh += p_hour

            p_eff = max(p_min, min(p_max, p_hour))
            factor = (p_eff - p_min) / (p_max - p_min) if p_max > p_min else 0.0

            eff_hour = eff_min + factor * (eff_max - eff_min)
            co2_hour = co2_min - factor * (co2_min - co2_max)

            fuel_cost_hour = p_hour * (hgsida_val / eff_hour)
            tons_hour = p_hour * co2_hour
            co2_cost_hour = tons_hour * co2_val

            unit_fuel_cost += fuel_cost_hour
            unit_co2_cost += co2_cost_hour
            unit_tons += tons_hour

        if unit_mwh > 0:
            total_unit_cost = unit_fuel_cost + unit_co2_cost
            srmc = total_unit_cost / unit_mwh if unit_mwh > 0 else 0.0

            units_summary.append({
                "Μονάδα": unit_name,
                "Παραγωγή (MWh)": float(round(unit_mwh, 2)),
                "Κόστος Καυσίμου (€)": float(round(unit_fuel_cost, 2)),
                "Κόστος CO2 (€)": float(round(unit_co2_cost, 2)),
                "Συνολικό Κόστος (€)": float(round(total_unit_cost, 2)),
                "SRMC Μέσος Όρος (€/MWh)": float(round(srmc, 2)),
                "Εκπομπές CO2 (t)": float(round(unit_tons, 2))
            })

            fleet_total_mwh += unit_mwh
            fleet_total_fuel_cost += unit_fuel_cost
            fleet_total_co2_cost += unit_co2_cost
            fleet_total_tons += unit_tons

    fleet_total_cost = fleet_total_fuel_cost + fleet_total_co2_cost
    fleet_srmc = fleet_total_cost / fleet_total_mwh if fleet_total_mwh > 0 else 0.0

    db["daily_economics"].append({
        "Ημερομηνία": date_str,
        "HGSIDA (€/MWh)": float(round(hgsida_val, 2)),
        "CO2 Price (€/t)": float(round(co2_val, 2)),
        "CO2 Price Estimated": co2_estimated,
        "Fleet Totals": {
            "Συνολική Παραγωγή (MWh)": float(round(fleet_total_mwh, 2)),
            "Συνολικό Κόστος Καυσίμου (€)": float(round(fleet_total_fuel_cost, 2)),
            "Συνολικό Κόστος CO2 (€)": float(round(fleet_total_co2_cost, 2)),
            "Συνολικό Κόστος Στόλου (€)": float(round(fleet_total_cost, 2)),
            "Μέσο SRMC Στόλου (€/MWh)": float(round(fleet_srmc, 2)),
            "Συνολικοί Τόνοι CO2 (t)": float(round(fleet_total_tons, 2))
        },
        "Units": units_summary
    })
    print(f"  [{date_str}] Economics calculated successfully.")

# ==========================================
# MAIN EXECUTION
# ==========================================
# ==========================================
# META (Τελευταία / Επόμενη ενημέρωση) + ΑΤΟΜΙΚΗ ΕΓΓΡΑΦΗ
# ==========================================
def compute_next_update(now):
    """Η πρώτη προγραμματισμένη ώρα (UPDATE_SCHEDULE, ώρα Ελλάδος) αυστηρά μετά το `now`.
    Οι ώρες 07:06 και 13:00 δεν πέφτουν ποτέ στην ώρα αλλαγής ώρας (03:00-04:00), άρα το localize είναι σαφές."""
    base = now.astimezone(TZ).date()
    for day_offset in range(0, 3):
        day = base + timedelta(days=day_offset)
        for hhmm in UPDATE_SCHEDULE:
            h, m = (int(x) for x in hhmm.split(":"))
            candidate = TZ.localize(datetime(day.year, day.month, day.day, h, m))
            if candidate > now:
                return candidate
    raise RuntimeError("UPDATE_SCHEDULE κενό ή μη έγκυρο")

def atomic_write_json(path, obj, **dump_kwargs):
    """Γράφει σε προσωρινό αρχείο και μετά το αντικαθιστά με os.replace: ποτέ μισογραμμένο αρχείο."""
    tmp_path = path + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, **dump_kwargs)
    os.replace(tmp_path, path)

def write_meta(now):
    """data/meta.json, ίδιο σχήμα με BESS και Flows (hub D06): `fetched` = πότε έτρεξε η λήψη και
    `next_update` = η επόμενη προγραμματισμένη εκτέλεση, και τα δύο σε UTC (...Z). Η ώρα Ελλάδος λογαριάζεται
    με τη ζώνη ώρας, άρα είναι σωστή και πριν/μετά την αλλαγή ώρας· η σελίδα μόνο τα δείχνει, σε ώρα Ελλάδος.
    Μοναδικός writer αυτό το script, ΜΟΝΟ αφού γραφτούν επιτυχώς τα δεδομένα."""
    def to_utc_z(dt):
        return dt.astimezone(pytz.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    meta = {
        "fetched": to_utc_z(now),
        "next_update": to_utc_z(compute_next_update(now)),
    }
    atomic_write_json(META_FILE, meta, indent=2)
    return meta

# ==========================================
# MWh ΠΕΡΙΟΡΙΣΜΩΝ (D29): πριν τους υπολόγιζε ο browser· τώρα το Python, η σελίδα μόνο τους δείχνει
# ==========================================
# Ρητός πίνακας: όνομα μονάδας στο ISP2 (αρχή του ονόματος) -> όνομα της ίδιας μονάδας στο SCADA. Η πρώτη αντιστοίχιση που ταιριάζει κερδίζει.
# Προσοχή: το KOMOTINI_POWER (νέος σταθμός) και τα KOMOTINI_G_* (παλιός σταθμός) διαφέρουν μόνο κατά μία λέξη.
CONSTRAINT_UNIT_MAP = (
    ("AG_NIKOLAOS", "AG_NIKOLAOS2"), ("ALIVERI", "ΑΛΙΒΕΡΙ 5"),
    ("ELPEDISON_THES", "ELPEDISON_THESS"), ("THESSALONIKI", "ELPEDISON_THESS"),
    ("ELPEDISON_THIS", "ELPEDISON_THISVI"), ("THISVI", "ELPEDISON_THISVI"),
    ("HERON", "ΘΗΣ ΗΡΩΝ"),
    ("KOMOTINI_POWER", "KOMOTINI_POWER"), ("KOMOTINI_G_", "ΚΟΜΟΤΗΝΗ"),
    ("KORINTHOS", "KORINTHOS_POWER"),
    ("LAVRIO4", "ΛΑΥΡΙΟ 4"), ("LAVRIO5", "ΛΑΥΡΙΟ 5"),
    ("MEGALOPOLI_V", "ΜΕΓΑΛΟΠΟΛΗ 5"), ("PROTERGIA", "PROTERGIA_CC"),
)

def resolve_constraint_unit(isp_name):
    n = str(isp_name).strip().upper()
    for prefix, scada_name in CONSTRAINT_UNIT_MAP:
        if n.startswith(prefix):
            return scada_name
    return None

def hourly_for(date_str):
    return [r for r in hourly if r.get("Ημερομηνία") == date_str]

def recompute_constrained():
    """MWh που παρήγαγε κάθε μονάδα Φ.Α. στις ώρες που το ISP2 την έχει σε Generic Constraint, ανά μέρα.
    Ώρες: ο ίδιος κανόνας με τον παλιό υπολογισμό του browser -- η ώρα «από» αυξάνεται κατά 1 και η ώρα «έως» κόβεται στην ακέραια ώρα
    (παράθυρο 11:00-15:30 = ώρες 12…15). Διαφορά: ΕΝΩΝΟΝΤΑΙ οι πραγματικές ώρες όλων των γραμμών της μονάδας, όχι το διάστημα από την
    πρώτη ως την τελευταία (ίδιο αποτέλεσμα σήμερα· δεν θα μετρήσει ώρες χωρίς constraint αν εμφανιστεί κενό).
    Μέρα χωρίς ωριαίο SCADA δεν παίρνει γραμμές (περιμένει). Άγνωστο όνομα ISP2 -> προειδοποίηση, δεν προσμετράται σιωπηλά."""
    hours_by = defaultdict(lambda: defaultdict(set))
    unmatched = set()
    for c in db["daily_gas_constraints"]:
        unit = resolve_constraint_unit(c.get("Gas Factory"))
        if unit is None:
            unmatched.add(str(c.get("Gas Factory")))
            continue
        try:
            h_from = int(str(c["Hour From"]).split(":")[0]) + 1
            h_to = int(str(c["Hour To"]).split(":")[0])
        except (KeyError, ValueError):
            continue
        hours_by[c["Date"]][unit].update(range(h_from, h_to + 1))
    blank_hours = defaultdict(lambda: defaultdict(set))
    for q in db["scada_quality"]:
        blank_hours[q.get("Ημερομηνία")][q.get("Μονάδα Φ.Α.")].update(q.get("Ώρες", []))
    rows, no_scada_unit = [], set()
    dates_with_hourly = {r.get("Ημερομηνία") for r in hourly}
    for d in sorted(hours_by):
        recs = {str(r.get("Μονάδα Φ.Α.")).strip(): r for r in hourly_for(d)}
        if not recs:
            continue
        for unit, hrs in sorted(hours_by[d].items()):
            rec = recs.get(unit)
            if rec is None:
                no_scada_unit.add((d, unit))
                continue
            used = sorted(h for h in hrs if 1 <= h <= 24)
            mwh = sum(float(rec.get(f"{h:02d}:00") or 0.0) for h in used)
            row = {"Date": d, "Unit": unit, "MWh": round(mwh, 3), "Hours": len(used)}
            missing = len([h for h in used if h in blank_hours[d][unit]])
            if missing:
                row["MissingHours"] = missing
            rows.append(row)
    # Οι γραμμές των ημερών που ΔΕΝ έχουν πια ωριαίο SCADA (παλαιότερες από KEEP_HOURLY_DAYS) μένουν όπως είναι (D30)·
    # ξαναϋπολογίζονται μόνο οι ημέρες που έχουν.
    kept = [r for r in db["daily_constrained_mwh"] if r.get("Date") not in dates_with_hourly]
    db["daily_constrained_mwh"] = sorted(kept + rows, key=lambda r: (r["Date"], r["Unit"]))
    rows = db["daily_constrained_mwh"]
    if unmatched:
        print(f"::warning title=Constraints::μονάδες του ISP2 χωρίς αντιστοίχιση στον πίνακα CONSTRAINT_UNIT_MAP (δεν προσμετρούνται): {sorted(unmatched)}")
    if no_scada_unit:
        print(f"  ⚠ Constraints: {len(no_scada_unit)} ζεύγη ημέρας-μονάδας χωρίς γραμμή SCADA, π.χ. {sorted(no_scada_unit)[:3]}")
    print(f"  Constrained MWh: {len(rows)} γραμμές, {len({r['Date'] for r in rows})} ημέρες, σύνολο {sum(r['MWh'] for r in rows):,.1f} MWh (ξαναϋπολογίστηκαν οι {len(dates_with_hourly)} ημέρες με ωριαίο SCADA)")

# ==========================================
# «ΤΕΛΕΥΤΑΙΑ ΣΩΣΤΑ ΔΕΔΟΜΕΝΑ» ΑΝΑ ΗΜΕΡΑ (D29): η wipe_date σβήνει την ημέρα πριν την επεξεργασία, άρα ένα σφάλμα ή μια προσωρινή
# αποτυχία λήψης θα την έχανε. Πριν το σβήσιμο κρατάμε αντίγραφο και το επαναφέρουμε όπου η νέα επεξεργασία δεν έδωσε τίποτα.
# ==========================================
DAY_KEYS = {
    "scada": ("scada_generation", "_hourly", "scada_quality"),
    "isp": ("isp_generation", "daily_surplus", "daily_gas_constraints"),
    "economics": ("daily_economics",),
}

def row_date(r):
    return r.get("Ημερομηνία") or r.get("Date")

def rows_of(k):
    """Οι γραμμές ενός κλειδιού· το «_hourly» είναι το ωριαίο SCADA των τελευταίων ημερών (data/scada_hourly.json)."""
    return hourly if k == "_hourly" else db[k]

def snapshot_day(date_str):
    return {k: [copy.deepcopy(r) for r in rows_of(k) if row_date(r) == date_str] for keys in DAY_KEYS.values() for k in keys}

def restore_keys(date_str, snap, keys):
    for k in keys:
        rest = [r for r in rows_of(k) if row_date(r) != date_str] + [copy.deepcopy(r) for r in snap[k]]
        if k == "_hourly":
            hourly[:] = rest
        else:
            db[k] = rest

def write_hourly_store(today):
    """Κρατά τις τελευταίες KEEP_HOURLY_DAYS ημέρες· το μέγεθος του αρχείου μένει σταθερό."""
    cutoff = (today.date() - timedelta(days=KEEP_HOURLY_DAYS)).strftime("%Y-%m-%d")
    hourly[:] = [r for r in hourly if str(r.get("Ημερομηνία")) >= cutoff]
    atomic_write_json(HOURLY_FILE, hourly, separators=(",", ":"))

def wipe_date(target_date_str):
    """Διαγράφει οριστικά ΟΛΑ τα δεδομένα μιας συγκεκριμένης ημερομηνίας πριν το backfill."""
    db["isp_generation"] = [d for d in db["isp_generation"] if d.get("Ημερομηνία") != target_date_str]
    db["scada_generation"] = [d for d in db["scada_generation"] if d.get("Ημερομηνία") != target_date_str]
    db["daily_economics"] = [d for d in db["daily_economics"] if d.get("Ημερομηνία") != target_date_str]
    db["daily_surplus"] = [d for d in db["daily_surplus"] if d.get("Date") != target_date_str]
    db["daily_gas_constraints"] = [d for d in db["daily_gas_constraints"] if d.get("Date") != target_date_str]
    db["scada_quality"] = [d for d in db["scada_quality"] if d.get("Ημερομηνία") != target_date_str]
    hourly[:] = [d for d in hourly if d.get("Ημερομηνία") != target_date_str]
    # ΔΕΝ διαγράφουμε henex και co2, γιατί αυτά είναι σωστά και γλιτώνουμε API calls!

if __name__ == "__main__":
    today = datetime.now(TZ)
    print(f"Starting Data Fetch Job at {today.strftime('%Y-%m-%d %H:%M:%S')}")

    # D16: τα ωριαία MCP της Αγοράς Επόμενης Ημέρας δεν χρησιμοποιούνταν από τη σελίδα· το κλειδί φεύγει από το αρχείο.
    if "dam_mcp_hourly" in db:
        _n = len(db.pop("dam_mcp_hourly"))
        print(f"Cleanup: αφαιρέθηκε το dam_mcp_hourly ({_n} ημέρες) -- δεν χρησιμοποιείται πια (D16).")

    # D30: το ωριαίο SCADA ζει μόνο στο data/scada_hourly.json (14 ημέρες)· στο historical.json δεν χρειάζεται πια (η σελίδα δεν το διαβάζει,
    # τα MWh των περιορισμών υπάρχουν ήδη στο daily_constrained_mwh). Το load_hourly() έτρεξε ήδη, άρα το αρχείο έχει τις ημέρες που χρειάζονται.
    if "scada_generation_hourly" in db:
        _days = len({r.get("Ημερομηνία") for r in db.pop("scada_generation_hourly")})
        print(f"Cleanup: αφαιρέθηκε το scada_generation_hourly ({_days} ημέρες) -- μένουν οι τελευταίες {KEEP_HOURLY_DAYS} στο {HOURLY_FILE} και τα MWh περιορισμών στο daily_constrained_mwh (D30).")

    # Εκκαθάριση: ό,τι δεν είναι μονάδα Φ.Α. (π.χ. η γραμμή AGRAS = υδροηλεκτρικό) φεύγει από τα constraints.
    _before = len(db["daily_gas_constraints"])
    db["daily_gas_constraints"] = [d for d in db["daily_gas_constraints"] if is_gas_constraint_unit(d.get("Gas Factory"))]
    if _before != len(db["daily_gas_constraints"]):
        print(f"Cleanup: αφαιρέθηκαν {_before - len(db['daily_gas_constraints'])} γραμμές constraints εκτός μονάδων Φ.Α.")
    
    start_env = os.environ.get('START_DATE')
    end_env = os.environ.get('END_DATE')
    
    date_list = []
    
    if start_env and end_env and start_env.strip() != "" and end_env.strip() != "":
        print(f"Manual backfill triggered from {start_env} to {end_env}")
        start_date = datetime.strptime(start_env.strip(), "%Y-%m-%d")
        end_date = datetime.strptime(end_env.strip(), "%Y-%m-%d")
        delta = end_date - start_date
        for i in range(delta.days + 1):
            date_list.append(start_date + timedelta(days=i))
    else:
        print("Standard daily cron triggered. Checking last 10 days.")
        for i in range(10, -1, -1):
            date_list.append(today - timedelta(days=i))
        fetch_latest_co2_price(today.strftime("%Y-%m-%d"))  # 1 κλήση/run, ΜΟΝΟ στο cron, ποτέ σε backfill
            
    for target_date in date_list:
        date_str = target_date.strftime("%Y-%m-%d")
        print(f"--> Processing Date: {date_str}")
        
        # 1. ΑΠΟΛΥΤΟΣ ΚΑΘΑΡΙΣΜΟΣ ΤΗΣ ΗΜΕΡΑΣ ΠΡΙΝ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ (με αντίγραφο των προηγούμενων δεδομένων της, D29)
        snap = snapshot_day(date_str)
        wipe_date(date_str)

        # 2. ΕΠΑΝΥΠΟΛΟΓΙΣΜΟΣ ΟΛΩΝ (Τώρα πια σε "καθαρό καμβά"). Κάθε βήμα μόνο του: ένα σφάλμα δεν σταματά τα υπόλοιπα ούτε τις άλλες ημέρες.
        # Αμέσως μετά από κάθε βήμα, αν απέτυχε ή δεν έδωσε τίποτα (σφάλμα, προσωρινή αποτυχία λήψης, αρχείο που δεν δημοσιεύτηκε),
        # επανέρχονται τα προηγούμενα σωστά δεδομένα του, ώστε και τα επόμενα βήματα (π.χ. τα οικονομικά) να δουλεύουν με αυτά.
        for name, fn, group in (("scada", process_scada, "scada"), ("isp", process_isp, "isp"), ("henex", process_henex, None),
                                ("co2", process_co2, None), ("economics", process_economics, "economics")):
            failed = False
            try:
                fn(date_str)
            except Exception as e:
                failed = True
                note_failure(date_str, name, e)
            if group:
                for k in DAY_KEYS[group]:
                    if snap[k] and (failed or not any(row_date(r) == date_str for r in rows_of(k))):
                        restore_keys(date_str, snap, DAY_KEYS[group] if failed else (k,))
                        print(f"  [{date_str}] ↺ το «{'ωριαίο SCADA' if k == '_hourly' else k}» {'απέτυχε' if failed else 'δεν ήρθε σήμερα'}· κρατήθηκαν τα προηγούμενα δεδομένα ({len(snap[k])} γραμμές)")
                        if failed:
                            break

        time.sleep(1)

    recompute_constrained()
    write_hourly_store(today)
    atomic_write_json(DATA_FILE, db, indent=2)
    meta = write_meta(datetime.now(TZ))
    print(f"meta.json: fetched={meta['fetched']} next_update={meta['next_update']}")

    if FAILURES:
        print(f"\n✗ Ολοκληρώθηκε με {len(FAILURES)} αποτυχίες (τα υπόλοιπα δεδομένα γράφτηκαν):")
        for d, st, err in FAILURES:
            print(f"::error title=Αποτυχία {d} ({st})::{err}")
        sys.exit(1)
    print("\n✔ Job Completed Successfully!")
