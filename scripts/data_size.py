#!/usr/bin/env python3
"""Μέτρηση του μεγέθους των δεδομένων (K11, τυφλοσούρτης «Μέγεθος δεδομένων με μέτρηση»).

Τι δείχνει: raw και gzip των αρχείων που κατεβάζει η σελίδα, τη σύνθεση του historical.json ανά κλειδί, τον ρυθμό αύξησης (ΜΕΤΡΗΜΕΝΟ, όχι
εκτίμηση: το μέγεθος του αρχείου μείον το μέγεθός του χωρίς τις τελευταίες 14 ημέρες, δια 14) και πόσες ημέρες μένουν μέχρι το όριο.
Χρήση: python scripts/data_size.py   (από τη ρίζα του repo)"""
import gzip, json, os, sys, datetime

LIMIT_KB = 250.0                 # όριο gzip του historical.json (K11): από εκεί και πέρα περνάμε σε αρχεία ανά μήνα
RATE_DAYS = 14
FILES = ["data/historical.json", "data/review.json", "data/meta.json"]
DATE_KEYS = ("Ημερομηνία", "Date")

def gz_kb(obj):
    # ΙΔΙΑ σειριοποίηση με αυτήν που γράφει το update_data.py (indent=2, ensure_ascii=False), ώστε το νούμερο να ταυτίζεται με το αρχείο που κατεβάζει η σελίδα
    return len(gzip.compress(json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8"), 6)) / 1024

def row_date(r):
    for k in DATE_KEYS:
        if isinstance(r, dict) and k in r:
            return r[k]
    return None

def main():
    if not os.path.exists(FILES[0]):
        print("Δεν βρέθηκε", FILES[0], "(τρέξε το από τη ρίζα του repo)"); return 1
    print(f"{'αρχείο':26s} {'raw KB':>9s} {'gzip KB':>9s}")
    for f in FILES:
        if os.path.exists(f):
            b = open(f, "rb").read(); print(f"{f:26s} {len(b)/1024:9.1f} {len(gzip.compress(b, 6))/1024:9.1f}")
    h = json.load(open(FILES[0], encoding="utf-8"))
    total = gz_kb(h)
    print(f"\nΣύνθεση του historical.json (σύνολο {total:.1f} KB gzip· το gzip του κάθε κλειδιού μόνου του, άρα το άθροισμα ξεπερνά λίγο το σύνολο):")
    for k, v in sorted(h.items(), key=lambda kv: -gz_kb(kv[1])):
        print(f"  {k:28s} {gz_kb(v):7.1f} KB  ({len(v) if hasattr(v, '__len__') else '-'} εγγραφές)")
    dates = sorted({d for v in h.values() if isinstance(v, list) for d in (row_date(r) for r in v) if d})
    if not dates:
        print("Δεν βρέθηκαν ημερομηνίες"); return 0
    last = datetime.date.fromisoformat(dates[-1]); cut = (last - datetime.timedelta(days=RATE_DAYS)).isoformat()
    cut_h = {k: ([r for r in v if (row_date(r) is None or row_date(r) <= cut)] if isinstance(v, list) else v) for k, v in h.items()}
    rate = (total - gz_kb(cut_h)) / RATE_DAYS
    left = (LIMIT_KB - total) / rate if rate > 0 else float("inf")
    print(f"\nΗμέρες στο ιστορικό: {len({d for d in dates})} ({dates[0]} … {dates[-1]})")
    print(f"Ρυθμός αύξησης (μετρημένος στις τελευταίες {RATE_DAYS} ημέρες): {rate:.2f} KB/ημέρα gzip")
    print(f"Μέχρι το όριο των {LIMIT_KB:.0f} KB: {LIMIT_KB - total:.1f} KB = περίπου {left:.0f} ημέρες" + (f" (γύρω στις {(last + datetime.timedelta(days=int(left))).isoformat()})" if left != float('inf') else ""))
    return 0

if __name__ == "__main__":
    sys.exit(main())
