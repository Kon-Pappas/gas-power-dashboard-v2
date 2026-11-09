#!/usr/bin/env python3
"""Έλεγχος των MWh περιορισμών (D29): ξαναϋπολογίζει, ΑΝΕΞΑΡΤΗΤΑ από το update_data.py, τα MWh κάθε μονάδας στις ώρες
που το ISP2 την έχει σε Generic Constraint, με τον κανόνα που είχε ο παλιός υπολογισμός του browser (κανονικοποίηση ονόματος
με κανόνες «περιέχει», παράθυρο από την πρώτη ως την τελευταία ώρα), και τα συγκρίνει με το `daily_constrained_mwh`
του data/historical.json. Δουλεύει για τις ημέρες που έχουν ωριαίο SCADA (στο historical.json ή στο data/scada_hourly.json).

Χρήση:  python scripts/check_constraints.py            (από τον κύριο φάκελο του repo)
Κωδικός εξόδου: 0 = όλα ίδια, 1 = υπάρχουν διαφορές ή λείπει το κλειδί."""
import json, os, re, sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo   # ΣΚΟΠΙΜΑ άλλη βιβλιοθήκη από τον update_data.py (pytz): ανεξάρτητη αντιστοίχιση ωρών (K20, D34)

DATA, HOURLY = 'data/historical.json', 'data/scada_hourly.json'
TOLERANCE = 0.01   # MWh ανά ημέρα (τα MWh της μονάδας στρογγυλοποιούνται στο 0,001)

def canon(raw):
    """Ο κανόνας του παλιού getCanonicalUnitName του dashboard.js (σκόπιμα διαφορετικός από τον πίνακα του update_data.py)."""
    if not raw: return "UNKNOWN"
    c = str(raw).strip().upper()
    if c == "KOMOTINI_POWER": return "KOMOTINI_POWER"
    if "KOMOTINI" in c or "ΚΟΜΟΤΗΝΗ" in c: return "KOMOTINI_POWER" if "POWER" in c else "ΚΟΜΟΤΗΝΗ"
    if "AG_NIKOLAOS" in c or "ΑΓ. ΝΙΚΟΛΑΟΣ" in c or "AGIOS NIKOLAOS" in c: return "AG_NIKOLAOS2"
    if "PROTERGIA" in c: return "PROTERGIA_CC"
    if "HERON" in c or "ΗΡΩΝ" in c: return "ΘΗΣ ΗΡΩΝ"
    if "MEGALOPOLI" in c or "ΜΕΓΑΛΟΠΟΛΗ" in c: return "ΜΕΓΑΛΟΠΟΛΗ 5"
    if "THISVI" in c or "ΘΗΣΒ" in c: return "ELPEDISON_THISVI"
    if "ELPEDISON" in c and "THIS" in c: return "ELPEDISON_THISVI"
    if "ELPEDISON" in c and "THES" in c: return "ELPEDISON_THESS"
    if "KORINTHOS" in c or "ΚΟΡΙΝΘΟΣ" in c: return "KORINTHOS_POWER"
    if "THESSALONIKI" in c: return "ELPEDISON_THESS"
    if "ALIVERI" in c or "ΑΛΙΒΕΡΙ" in c: return "ΑΛΙΒΕΡΙ 5"
    if "LAVRIO 5" in c or "ΛΑΥΡΙΟ 5" in c or "LAVRIO5" in c: return "ΛΑΥΡΙΟ 5"
    if "LAVRIO" in c or "ΛΑΥΡΙΟ" in c: return "ΛΑΥΡΙΟ 4"
    if "ALOUMINIO" in c or "ΑΛΟΥΜΙΝΙΟ" in c or "ALUM" in c: return "ΑΛΟΥΜΙΝΙΟ"
    return c

ATH = ZoneInfo("Europe/Athens")

def hour_labels(date):
    """Η ώρα ρολογιού στην αρχή κάθε πραγματικής ώρας της ημέρας (24ωρη: 0…23, 25ωρη: 0,1,2,3,3,4…23, 23ωρη: 0,1,2,4…23)."""
    d = datetime.strptime(date, "%Y-%m-%d"); m0 = datetime(d.year, d.month, d.day, tzinfo=ATH).astimezone(timezone.utc)
    nxt = d + timedelta(days=1); m1 = datetime(nxt.year, nxt.month, nxt.day, tzinfo=ATH).astimezone(timezone.utc)
    n = int(round((m1 - m0).total_seconds() / 3600))
    return [(m0 + timedelta(hours=i)).astimezone(ATH).hour for i in range(n)]

def hour_window(date, hf, ht):
    """(πρώτος, τελευταίος) δείκτης στήλης ωριαίου SCADA, και οι δύο μέσα· ολόκληρες ώρες ρολογιού, κόψιμο προς τα κάτω (όπως ο παλιός κανόνας)."""
    s_h, e_h = int(hf.split(":")[0]), int(ht.split(":")[0])
    idx = [i + 1 for i, label in enumerate(hour_labels(date)) if s_h <= label <= e_h - 1]
    return (idx[0], idx[-1]) if idx else (1, 0)

def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def main():
    if not os.path.exists(DATA):
        print(f"Δεν βρέθηκε το {DATA} (τρέξε το script από τον κύριο φάκελο του repo)."); return 1
    db = load(DATA)
    if 'daily_constrained_mwh' not in db:
        print("Το historical.json δεν έχει ακόμα το daily_constrained_mwh (δεν έχει τρέξει το νέο update_data.py)."); return 1
    hourly = {}
    for r in db.get('scada_generation_hourly', []) + (load(HOURLY) if os.path.exists(HOURLY) else []):
        hourly[(r['Ημερομηνία'], str(r['Μονάδα Φ.Α.']).strip())] = r
    windows = defaultdict(dict)                                  # ημέρα -> κανονική μονάδα -> (πρώτη ώρα, τελευταία ώρα)
    for c in db['daily_gas_constraints']:
        hs, he = hour_window(c['Date'], str(c['Hour From']), str(c['Hour To']))
        if hs <= he:
            u, w = canon(c['Gas Factory']), windows[c['Date']].get(canon(c['Gas Factory']))
            windows[c['Date']][u] = (hs, he) if not w else (min(w[0], hs), max(w[1], he))
    expected, hourly_days = defaultdict(float), {d for d, _ in hourly}
    for (d, unit), rec in hourly.items():
        w = windows.get(d, {}).get(canon(unit))
        if w:
            expected[d] += sum(float(rec.get(f'{h:02d}:00') or 0.0) for h in range(w[0], w[1] + 1) if 1 <= h <= 25)
    got = defaultdict(float)
    for r in db['daily_constrained_mwh']:
        got[r['Date']] += r['MWh']
    days = sorted(d for d in set(expected) | set(got) if d in hourly_days)
    bad = [(d, round(expected.get(d, 0), 3), round(got.get(d, 0), 3)) for d in days if abs(expected.get(d, 0) - got.get(d, 0)) > TOLERANCE]
    print(f"Ημέρες που ελέγχθηκαν (έχουν ωριαίο SCADA): {len(days)} | με περιορισμό: {sum(1 for d in days if expected.get(d))}")
    print(f"Σύνολο ανεξάρτητου υπολογισμού: {sum(expected[d] for d in days if d in expected):,.3f} MWh | σύνολο daily_constrained_mwh: {sum(got[d] for d in days if d in got):,.3f} MWh")
    missing = sum(r.get('MissingHours', 0) for r in db['daily_constrained_mwh'])
    if missing: print(f"Προσοχή: {missing} ώρες με κενό κελί στο SCADA μέσα σε παράθυρα περιορισμού (MissingHours).")
    if bad:
        print(f"✗ {len(bad)} ημέρες διαφέρουν (ημέρα, ανεξάρτητος υπολογισμός, daily_constrained_mwh):")
        for b in bad[:20]: print("  ", b)
        return 1
    print("✔ Όλες οι ημέρες ταυτίζονται.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
