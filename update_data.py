import os
import json
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pytz
import io
import math

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
        "daily_surplus", "daily_gas_constraints"]
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
                if path.lower().endswith((".xls", ".xlsx")):
                    return f"https://www.admie.gr{path}" if path.startswith("/") else path
    except Exception as e:
        print(f"Error fetching ADMIE API for {file_category}: {e}")
    return None

def fetch_excel(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        if resp.status_code == 200:
            return io.BytesIO(resp.content)
    except Exception as e:
        print(f"Error downloading Excel from {url}: {e}")
    return None

# ==========================================
# PROCESSORS
# ==========================================
def process_scada(date_str):
    url = get_admie_excel_url(date_str, "SystemRealizationSCADA")
    if not url: return
    excel_data = fetch_excel(url)
    if not excel_data: return

    try:
        df = pd.read_excel(excel_data, sheet_name=0, header=None)
        
        # Εντοπισμός ενοτήτων Φ.Α.
        start_mask = df[1].astype(str).str.contains("ΜΟΝΑΔΕΣ Φ. ΑΕΡΙΟΥ|ΜΟΝΑΔΕΣ ΦΥΣΙΚΟΥ ΑΕΡΙΟΥ", case=False, na=False)
        if not start_mask.any(): return
        start_idx = df[start_mask].index[0]
        
        end_mask = df[1].astype(str).str.contains("TOTAL GAS|ΥΔΡΟΗΛΕΚΤΡΙΚΕΣ", case=False, na=False)
        end_idx = df.iloc[start_idx+1:][end_mask].index[0] if end_mask.any() else len(df)

        gas_df = df.iloc[start_idx+1:end_idx].copy()
        gas_df = gas_df.dropna(subset=[1])
        
        total_gas = 0
        for _, row in gas_df.iterrows():
            raw_name = str(row[1]).strip()
            if not raw_name or raw_name.lower() == 'nan': continue
            
            # SCADA HOURLY & DAILY SUM
            unit_name = raw_name.replace("(ST)", "").replace("(GT1)", "").replace("(GT2)", "").strip()
            
            hourly_vals = []
            for j in range(2, 26):
                val = pd.to_numeric(str(row.iloc[j]).replace(' ', '').replace(',', '.'), errors='coerce') if j < len(row) else 0
                if math.isnan(val): val = 0
                hourly_vals.append(val)
                
            daily_sum = round(sum(hourly_vals), 3)
            total_gas += daily_sum

            # Update SCADA Daily
            if not any(d.get("Ημερομηνία") == date_str and d.get("Μονάδα Φ.Α.") == unit_name for d in db["scada_generation"]):
                db["scada_generation"].append({
                    "Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name, "Παραγωγή SCADA (MWh)": daily_sum
                })
                
            # Update SCADA Hourly
            if not any(d.get("Ημερομηνία") == date_str and d.get("Μονάδα Φ.Α.") == unit_name for d in db["scada_generation_hourly"]):
                hourly_record = {"Ημερομηνία": date_str, "Μονάδα Φ.Α.": unit_name}
                for h in range(1, 25):
                    hourly_record[f"{h:02d}:00"] = hourly_vals[h-1]
                hourly_record["Ημερήσιο Σύνολο"] = daily_sum
                db["scada_generation_hourly"].append(hourly_record)

        if total_gas > 0 and not any(d.get("Ημερομηνία") == date_str and d.get("Μονάδα Φ.Α.") == "TOTAL GAS UNITS" for d in db["scada_generation"]):
            db["scada_generation"].append({
                "Ημερομηνία": date_str, "Μονάδα Φ.Α.": "TOTAL GAS UNITS", "Παραγωγή SCADA (MWh)": round(total_gas, 3)
            })
            
    except Exception as e:
        print(f"Error parsing SCADA for {date_str}: {e}")

def process_henex(date_str):
    if any(d.get("Ημερομηνία") == date_str for d in db["henex_indices"]): return

    date_for_url = date_str.replace("-", "")
    base_url = f"https://www.enexgroup.gr/documents/20126/997118/{date_for_url}_NGAS_DOL_EN_v"
    
    excel_data = None
    for v in range(1, 4):
        url = f"{base_url}{v:02d}.xlsx"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                excel_data = io.BytesIO(resp.content)
                break
        except: pass
            
    if not excel_data: return

    try:
        df = pd.read_excel(excel_data, sheet_name=0, header=None)
        header_mask = df.apply(lambda r: r.astype(str).str.contains("Contract", case=False).any(), axis=1)
        if not header_mask.any(): return
        
        header_idx = df[header_mask].index[0]
        df.columns = df.iloc[header_idx]
        df = df.iloc[header_idx+1:]
        
        hgsida, hgsiwd, hgmbi, hgmsi = 0, 0, 0, 0
        for _, row in df.iterrows():
            contract = str(row.get("Contract", "")).strip()
            if contract == "DA":
                hgsida = pd.to_numeric(str(row.get("HGSIDA", 0)).replace(',', '.'), errors='coerce')
            elif contract == "WD":
                hgsiwd = pd.to_numeric(str(row.get("HGSIWD", 0)).replace(',', '.'), errors='coerce')
                hgmbi = pd.to_numeric(str(row.get("HGMBI", 0)).replace(',', '.'), errors='coerce')
                hgmsi = pd.to_numeric(str(row.get("HGMSI", 0)).replace(',', '.'), errors='coerce')

        db["henex_indices"].append({
            "Ημερομηνία": date_str, "HGSIDA (€/MWh)": 0 if math.isnan(hgsida) else hgsida,
            "HGSIWD (€/MWh)": 0 if math.isnan(hgsiwd) else hgsiwd,
            "HGMBI (€/MWh)": 0 if math.isnan(hgmbi) else hgmbi,
            "HGMSI (€/MWh)": 0 if math.isnan(hgmsi) else hgmsi
        })
    except Exception as e:
        print(f"Error parsing HEnEx for {date_str}: {e}")

# ==========================================
# MAIN EXECUTION
# ==========================================
if __name__ == "__main__":
    today = datetime.now(TZ)
    print(f"Starting Data Fetch Job at {today.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Αναζήτηση για τις τελευταίες 3 ημέρες για ασφάλεια (catch-up)
    for i in range(2, -1, -1):
        target_date = today - timedelta(days=i)
        date_str = target_date.strftime("%Y-%m-%d")
        print(f"--> Processing Date: {date_str}")
        
        process_scada(date_str)
        process_henex(date_str)
        # Σημείωση: Αν θέλεις μπορούμε να προσθέσουμε απευθείας και τις process_isp / process_dam στο επόμενο βήμα!

    # Αποθήκευση στο αρχείο historical.json
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
        
    print("✔ Job Completed Successfully!")
