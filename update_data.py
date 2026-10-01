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

# ==========================================
# CONFIGURATION
# ==========================================
DATA_FILE = 'data/historical.json'
ADMIE_API_URL = "https://www.admie.gr/getOperationMarketFile"
TZ = pytz.timezone('Europe/Athens')

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

keys = ["isp_generation", "scada_generation", "scada_generation_hourly", 
        "henex_indices", "dam_mcp_hourly", "thermal_efficiency", 
        "daily_surplus", "daily_gas_constraints", "co2_prices", "daily_economics"]
for k in keys:
    if k not in db:
        db[k] = []

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
    except Exception:
        pass
    return None

def fetch_excel(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        if resp.status_code == 200:
            return io.BytesIO(resp.content)
    except:
        pass
    return None

# ==========================================
# PROCESSORS (ADMIE & HENEX & CO2)
# ==========================================
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
        db["scada_generation_hourly"] = [d for d in db["scada_generation_hourly"] if d.get("Ημερομηνία") != date_str]
        
        # Λεξικό για την αποθήκευση μοναδικών εγγραφών ανά μονάδα
        daily_units_data = {} 
        
        def extract_hourly_data(row):
            hourly_vals = []
            for j in range(2, 26):
                val = pd.to_numeric(str(row.iloc[j]).replace(' ', '').replace(',', '.'), errors='coerce') if j < len(row) else 0
                hourly_vals.append(0.0 if pd.isna(val) else float(val))
            return hourly_vals

        # 2. Σάρωση για Μονάδες Φυσικού Αερίου (Κλασικό μπλοκ)
        start_mask = df[1].astype(str).str.contains("ΜΟΝΑΔΕΣ Φ. ΑΕΡΙΟΥ|ΜΟΝΑΔΕΣ ΦΥΣΙΚΟΥ ΑΕΡΙΟΥ", case=False, na=False)
        if start_mask.any():
            start_idx = df[start_mask].index[0]
            end_mask = df[1].astype(str).str.contains("TOTAL GAS|ΥΔΡΟΗΛΕΚΤΡΙΚΕΣ|ΣΥΜΠΑΡΑΓΩΓΗ", case=False, na=False)
            end_idx_matches = df.iloc[start_idx+1:][end_mask].index
            end_idx = end_idx_matches[0] if len(end_idx_matches) > 0 else len(df)
            
            for _, row in df.iloc[start_idx+1:end_idx].iterrows():
                raw_name = str(row[1]).strip()
                if not raw_name or raw_name.lower() == 'nan': continue
                if "TOTAL" in raw_name.upper() or "ΣΥΝΟΛΟ" in raw_name.upper(): continue
                
                unit_name = re.sub(r'\s*\((ST|GT\d+)\)', '', raw_name, flags=re.IGNORECASE).strip()
                hourly_vals = extract_hourly_data(row)
                
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
                 
                 hourly_vals = extract_hourly_data(row)
                 unit_name = "ΑΛΟΥΜΙΝΙΟ" 
                 
                 if unit_name in daily_units_data:
                     daily_units_data[unit_name] = [sum(x) for x in zip(daily_units_data[unit_name], hourly_vals)]
                 else:
                     daily_units_data[unit_name] = hourly_vals

        # 4. Εγγραφή των καθαρών, μοναδικών δεδομένων
        if not daily_units_data: return
        
        total_gas = 0.0
        for unit_name, hourly_vals in daily_units_data.items():
            daily_sum = float(round(sum(hourly_vals), 3))
            total_gas += daily_sum
            
            db["scada_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name, "Παραγωγή SCADA (MWh)": daily_sum})
            
            hourly_record = {"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name}
            for h in range(1, 25): 
                hourly_record[f"{h:02d}:00"] = hourly_vals[h-1]
            hourly_record["Ημερήσιο Σύνολο"] = daily_sum
            db["scada_generation_hourly"].append(hourly_record)
            
        # Εγγραφή TOTAL 
        if total_gas > 0:
            db["scada_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": "TOTAL GAS UNITS", "Παραγωγή SCADA (MWh)": float(round(total_gas, 3))})
            
    except Exception as e:
        print(f"Error parsing SCADA for {date_str}: {e}")

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
            print(f"Error parsing Generic Constraints for {date_str}: {e}")
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
                end_idx_matches = df.iloc[start_idx+1:][end_mask].index
                end_idx = end_idx_matches[0] if len(end_idx_matches) > 0 else len(df)
                gas_df = df.iloc[start_idx+1:end_idx].copy().dropna(subset=[0])
                total_isp = 0.0
                for _, row in gas_df.iterrows():
                    unit = str(row[0]).strip()
                    if not unit or unit.lower() == 'nan': continue
                    if any(l in unit.upper() for l in ["AG_DIMITRIOS", "PTOLEMAIDA", "MEGALOPOLI4", "MEGALOPOLI3", "MELITI", "AGIOS DIMITRIOS"]): continue
                    vals = pd.to_numeric(row.iloc[2:98].astype(str).str.replace(' ', '').str.replace(',', '.'), errors='coerce')
                    daily_mwh = float(round(vals.sum() / 4, 3))
                    total_isp += daily_mwh
                    db["isp_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit, "Παραγωγή (MWh)": daily_mwh})
                if total_isp > 0:
                    db["isp_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": "TOTAL GAS UNITS", "Παραγωγή (MWh)": float(round(total_isp, 3))})
    except Exception as e:
        print(f"Error parsing ISP for {date_str}: {e}")

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
        except: pass

def process_dam(date_str):
    if any(d.get("Ημερομηνία") == date_str for d in db["dam_mcp_hourly"]): return
    date_for_url = date_str.replace("-", "")
    for v in range(1, 4):
        url = f"https://www.enexgroup.gr/documents/20126/366820/{date_for_url}_EL-DAM_ResultsSummary_EN_v{v:02d}.xlsx"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                xl = pd.ExcelFile(io.BytesIO(resp.content))
                target_sheet = [s for s in xl.sheet_names if "SPOT_SUMMARY (SELL)" in str(s).upper()]
                if not target_sheet: continue
                df = xl.parse(target_sheet[0], header=None)
                for _, row in df.iterrows():
                    if "60MIN INDEX" in str(row[0]).upper():
                        hourly_prices = {}
                        for h in range(24):
                            idx = 1 + (h * 4) 
                            if idx < len(row):
                                val = pd.to_numeric(str(row.iloc[idx]).replace(',', '.'), errors='coerce')
                                hourly_prices[f"{(h+1):02d}:00"] = 0.0 if pd.isna(val) else float(round(val, 3))
                        if len(hourly_prices) == 24:
                            record = {"Ημερομηνία": date_str}
                            record.update(hourly_prices)
                            db["dam_mcp_hourly"].append(record)
                        break
                break
        except: pass

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

    hourly_records = [r for r in db["scada_generation_hourly"] if r.get("Ημερομηνία") == date_str]
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

        for h in range(1, 25):
            hour_key = f"{h:02d}:00"
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
def wipe_date(target_date_str):
    """Διαγράφει οριστικά ΟΛΑ τα δεδομένα μιας συγκεκριμένης ημερομηνίας πριν το backfill."""
    db["isp_generation"] = [d for d in db["isp_generation"] if d.get("Ημερομηνία") != target_date_str]
    db["scada_generation"] = [d for d in db["scada_generation"] if d.get("Ημερομηνία") != target_date_str]
    db["scada_generation_hourly"] = [d for d in db["scada_generation_hourly"] if d.get("Ημερομηνία") != target_date_str]
    db["daily_economics"] = [d for d in db["daily_economics"] if d.get("Ημερομηνία") != target_date_str]
    db["daily_surplus"] = [d for d in db["daily_surplus"] if d.get("Date") != target_date_str]
    db["daily_gas_constraints"] = [d for d in db["daily_gas_constraints"] if d.get("Date") != target_date_str]
    # ΔΕΝ διαγράφουμε henex και co2, γιατί αυτά είναι σωστά και γλιτώνουμε API calls!

if __name__ == "__main__":
    today = datetime.now(TZ)
    print(f"Starting Data Fetch Job at {today.strftime('%Y-%m-%d %H:%M:%S')}")

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
        
        # 1. ΑΠΟΛΥΤΟΣ ΚΑΘΑΡΙΣΜΟΣ ΤΗΣ ΗΜΕΡΑΣ ΠΡΙΝ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ
        wipe_date(date_str)
        
        # 2. ΕΠΑΝΥΠΟΛΟΓΙΣΜΟΣ ΟΛΩΝ (Τώρα πια σε "καθαρό καμβά")
        process_scada(date_str)
        process_isp(date_str)
        process_henex(date_str)
        process_dam(date_str)
        process_co2(date_str)
        process_economics(date_str)
        
        time.sleep(1)

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
        
    print("\n✔ Job Completed Successfully!")
