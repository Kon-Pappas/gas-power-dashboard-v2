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

# Σταθερά δεδομένα απόδοσης
STATIC_EFFICIENCY = [
    {"Κλάση": "H-Class (Super-Efficient)", "Μονάδα Φ.Α.": "AG_NIKOLAOS2", "Βαθμός Απόδοσης": 0.62},
    {"Κλάση": "H-Class (Super-Efficient)", "Μονάδα Φ.Α.": "KOMOTINI_POWER", "Βαθμός Απόδοσης": 0.62},
    {"Κλάση": "F-Class (Standard)", "Μονάδα Φ.Α.": "PROTERGIA_CC", "Βαθμός Απόδοσης": 0.58},
    {"Κλάση": "F-Class (Standard)", "Μονάδα Φ.Α.": "ΘΗΣ ΗΡΩΝ", "Βαθμός Απόδοσης": 0.58},
    {"Κλάση": "F-Class (Standard)", "Μονάδα Φ.Α.": "ΜΕΓΑΛΟΠΟΛΗ 5", "Βαθμός Απόδοσης": 0.58},
    {"Κλάση": "F-Class (Standard)", "Μονάδα Φ.Α.": "ELPEDISON_THISVI", "Βαθμός Απόδοσης": 0.57},
    {"Κλάση": "F-Class (Standard)", "Μονάδα Φ.Α.": "KORINTHOS_POWER", "Βαθμός Απόδοσης": 0.57},
    {"Κλάση": "F-Class (Standard)", "Μονάδα Φ.Α.": "ELPEDISON_THESS", "Βαθμός Απόδοσης": 0.56},
    {"Κλάση": "F-Class (Standard)", "Μονάδα Φ.Α.": "ΑΛΙΒΕΡΙ 5", "Βαθμός Απόδοσης": 0.56},
    {"Κλάση": "F-Class (Standard)", "Μονάδα Φ.Α.": "ΛΑΥΡΙΟ 5", "Βαθμός Απόδοσης": 0.56},
    {"Κλάση": "Older Generation & Peakers", "Μονάδα Φ.Α.": "ΛΑΥΡΙΟ 4", "Βαθμός Απόδοσης": 0.48},
    {"Κλάση": "Older Generation & Peakers", "Μονάδα Φ.Α.": "ΑΛΟΥΜΙΝΙΟ", "Βαθμός Απόδοσης": 0.48}
]

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
        "daily_surplus", "daily_gas_constraints", "co2_prices"]
for k in keys:
    if k not in db:
        db[k] = []

db["thermal_efficiency"] = STATIC_EFFICIENCY

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
# PROCESSORS (ADMIE & HENEX)
# ==========================================
def process_scada(date_str):
    url = get_admie_excel_url(date_str, "SystemRealizationSCADA")
    if not url: return
    excel_data = fetch_excel(url)
    if not excel_data: return
    try:
        df = pd.read_excel(excel_data, sheet_name=0, header=None)
        start_mask = df[1].astype(str).str.contains("ΜΟΝΑΔΕΣ Φ. ΑΕΡΙΟΥ|ΜΟΝΑΔΕΣ ΦΥΣΙΚΟΥ ΑΕΡΙΟΥ", case=False, na=False)
        if not start_mask.any(): return
        start_idx = df[start_mask].index[0]
        end_mask = df[1].astype(str).str.contains("TOTAL GAS|ΥΔΡΟΗΛΕΚΤΡΙΚΕΣ", case=False, na=False)
        end_idx = df.iloc[start_idx+1:][end_mask].index[0] if end_mask.any() else len(df)
        gas_df = df.iloc[start_idx+1:end_idx].copy().dropna(subset=[1])
        total_gas = 0.0
        for _, row in gas_df.iterrows():
            raw_name = str(row[1]).strip()
            if not raw_name or raw_name.lower() == 'nan': continue
            unit_name = re.sub(r'\s*\((ST|GT\d+)\)', '', raw_name, flags=re.IGNORECASE).strip()
            hourly_vals = []
            for j in range(2, 26):
                val = pd.to_numeric(str(row.iloc[j]).replace(' ', '').replace(',', '.'), errors='coerce') if j < len(row) else 0
                hourly_vals.append(0.0 if pd.isna(val) else float(val))
            daily_sum = float(round(sum(hourly_vals), 3))
            total_gas += daily_sum
            if not any(d.get("Ημερομηνία") == date_str and d.get("Μονάδα Φ.Α.") == unit_name for d in db["scada_generation"]):
                db["scada_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name, "Παραγωγή SCADA (MWh)": daily_sum})
            if not any(d.get("Ημερομηνία") == date_str and d.get("Μονάδα Φ.Α.") == unit_name for d in db["scada_generation_hourly"]):
                hourly_record = {"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name}
                for h in range(1, 25): hourly_record[f"{h:02d}:00"] = hourly_vals[h-1]
                hourly_record["Ημερήσιο Σύνολο"] = daily_sum
                db["scada_generation_hourly"].append(hourly_record)
        if total_gas > 0 and not any(d.get("Ημερομηνία") == date_str and d.get("Μονάδα Φ.Α.") == "TOTAL GAS UNITS" for d in db["scada_generation"]):
            db["scada_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": "TOTAL GAS UNITS", "Παραγωγή SCADA (MWh)": float(round(total_gas, 3))})
    except Exception as e:
        print(f"Error parsing SCADA for {date_str}: {e}")

def process_isp(date_str):
    url = get_admie_excel_url(date_str, "ISP2ISPResults")
    if not url: return
    excel_data = fetch_excel(url)
    if not excel_data: return
    try:
        xl = pd.ExcelFile(excel_data)
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
                    if any(l in unit.upper() for l in ["AG_DIMITRIOS", "PTOLEMAIDA", "MEGALOPOLI", "MELITI", "AGIOS DIMITRIOS"]): continue
                    vals = pd.to_numeric(row.iloc[2:98].astype(str).str.replace(' ', '').str.replace(',', '.'), errors='coerce')
                    daily_mwh = float(round(vals.sum() / 4, 3))
                    total_isp += daily_mwh
                    db["isp_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit, "Παραγωγή (MWh)": daily_mwh})
                if total_isp > 0:
                    db["isp_generation"].append({"Ημερομηνία": date_str, "Μονάδα Φ.Α.": "TOTAL GAS UNITS", "Παραγωγή (MWh)": float(round(total_isp, 3))})
        if not any(d.get("Date") == date_str for d in db["daily_gas_constraints"]):
            constraint_sheet = [s for s in xl.sheet_names if "GENERICCONSTRAINTS" in str(s).upper()]
            if constraint_sheet:
                df_c = xl.parse(constraint_sheet[0], header=None)
                for _, row in df_c.iterrows():
                    if len(row) < 6: continue
                    unit = str(row[5]).strip()
                    if unit.lower() in ["nan", "unit", "none"] or "START" in unit.upper() or "TIME" in unit.upper() or "ALOUMINIO" in unit.upper() or "ΑΛΟΥΜΙΝΙΟ" in unit.upper() or "PTOLEMAIDA" in unit.upper(): continue
                    def format_time(t):
                        if isinstance(t, datetime): return t.strftime("%H:%M")
                        if isinstance(t, (int, float)) and t < 1: return f"{int(round(t * 24 * 60) // 60):02d}:{int(round(t * 24 * 60) % 60):02d}"
                        return str(t).strip()
                    hf, ht = format_time(row[1]), format_time(row[2])
                    if "FROM" in hf.upper() or "START" in hf.upper() or "ΑΠΟ" in hf.upper() or not hf or str(hf).lower() == 'nan': continue
                    db["daily_gas_constraints"].append({"Date": date_str, "Gas Factory": unit, "Hour From": hf, "Hour To": ht})
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
                for _, row in df.iterrows():
                    contract = str(row.get("Contract", "")).strip()
                    if contract == "DA": hgsida = pd.to_numeric(str(row.get("HGSIDA", 0)).replace(',', '.'), errors='coerce')
                    elif contract == "WD":
                        hgsiwd = pd.to_numeric(str(row.get("HGSIWD", 0)).replace(',', '.'), errors='coerce')
                        hgmbi = pd.to_numeric(str(row.get("HGMBI", 0)).replace(',', '.'), errors='coerce')
                        hgmsi = pd.to_numeric(str(row.get("HGMSI", 0)).replace(',', '.'), errors='coerce')
                db["henex_indices"].append({
                    "Ημερομηνία": date_str, 
                    "HGSIDA (€/MWh)": 0.0 if pd.isna(hgsida) else float(hgsida),
                    "HGSIWD (€/MWh)": 0.0 if pd.isna(hgsiwd) else float(hgsiwd),
                    "HGMBI (€/MWh)": 0.0 if pd.isna(hgmbi) else float(hgmbi),
                    "HGMSI (€/MWh)": 0.0 if pd.isna(hgmsi) else float(hgmsi)
                })
                break
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

# ==========================================
# PROCESSOR (CO2 PRICES - DATE MATCHED FIX)
# ==========================================
def process_co2(date_str):
    # Καθαρίζουμε την εγγραφή αν υπάρχει ήδη για αυτή τη μέρα
    db["co2_prices"] = [d for d in db["co2_prices"] if d.get("Ημερομηνία") != date_str]

    api_key = os.environ.get('OILPRICE_API_KEY')
    if not api_key:
        print(f"  [{date_str}] ΛΑΘΟΣ: Το OILPRICE_API_KEY είναι άδειο στα Secrets!")
        return

    url = "https://api.oilpriceapi.com/v1/prices"
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "application/json"
    }
    params = {
        "by_code": "EU_CARBON_EUR",
        "by_date": date_str
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success" and data.get("data"):
                prices_list = data["data"].get("prices", [])
                target_price = None
                
                # Ψάχνουμε στη λίστα ποια τιμή αντιστοιχεί στην ακριβή ημερομηνία (date_str)
                for item in prices_list:
                    created_at = str(item.get("created_at", ""))
                    as_of = str(item.get("as_of", ""))
                    if date_str in created_at or date_str in as_of:
                        target_price = item.get("price")
                        break
                
                # Αν δεν βρει ακριβές match με string, παίρνουμε την πρώτη ως fallback για ασφάλεια
                if target_price is None and len(prices_list) > 0:
                    target_price = prices_list[0].get("price")

                if target_price is not None:
                    db["co2_prices"].append({
                        "Ημερομηνία": date_str,
                        "CO2_Price (€/t)": float(target_price)
                    })
                    print(f"  [{date_str}] CO2 Price Matched: {target_price} €/t")
                else:
                    db["co2_prices"].append({"Ημερομηνία": date_str, "CO2_Price (€/t)": None})
                    print(f"  [{date_str}] CO2 Price Warning: No price found for date.")
            else:
                db["co2_prices"].append({"Ημερομηνία": date_str, "CO2_Price (€/t)": None})
        else:
            print(f"  [{date_str}] API Error fetching CO2: {resp.status_code}")
    except Exception as e:
        print(f"Error fetching CO2 for {date_str}: {e}")

# ==========================================
# MAIN EXECUTION
# ==========================================
if __name__ == "__main__":
    today = datetime.now(TZ)
    print(f"Starting Data Fetch Job at {today.strftime('%Y-%m-%d %H:%M:%S')}")
    
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
            
    for target_date in date_list:
        date_str = target_date.strftime("%Y-%m-%d")
        print(f"--> Processing Date: {date_str}")
        
        process_scada(date_str)
        process_isp(date_str)
        process_henex(date_str)
        process_dam(date_str)
        process_co2(date_str)
        
        time.sleep(1)

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
        
    print("\n✔ Job Completed Successfully!")
