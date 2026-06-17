"""
generate_seed_data.py
=====================
Run this ONCE before deploying to Render.
It creates kaggle_seed.csv — the bootstrap dataset for the model.

HOW TO GET REAL DATASETS:
--------------------------
1. KAGGLE (Queue Waiting Time Prediction):
   - Go to: https://www.kaggle.com/datasets/sanjeebtiwary/queue-waiting-time-prediction
   - Download the CSV
   - Put it in the same folder as this file
   - Run: python generate_seed_data.py --source kaggle --file <downloaded_file.csv>

2. HUGGING FACE (no direct queue dataset — we generate synthetic):
   - pip install datasets
   - Run: python generate_seed_data.py --source synthetic

3. IEEE DataPort:
   - Go to: https://ieee-dataport.org/documents/queue-waiting-time-dataset
   - Free account required
   - Download and pass with --source ieee --file <file.csv>

Usage:
    python generate_seed_data.py               # generates synthetic seed
    python generate_seed_data.py --source kaggle --file queue_data.csv
"""

import csv
import random
import math
import argparse
import os
from datetime import datetime, timedelta

OUTPUT_FILE = "kaggle_seed.csv"
FIELDNAMES  = [
    "queue_length", "avg_service_time", "hour_of_day",
    "day_of_week",  "staff_count",      "branch_id",
    "actual_wait_minutes"
]


# ── helpers ──────────────────────────────────────────────────────
def is_peak(hour: int) -> bool:
    return (12 <= hour <= 14) or (19 <= hour <= 22)

def simulate_wait(queue_len, avg_svc, hour, staff, noise=True) -> float:
    """
    Realistic wait time formula:
    base  = (queue_length * avg_service_time) / staff_count
    peak  = +30 % during peak hours
    noise = ±15 % random variation
    """
    base  = (queue_len * avg_svc) / max(1, staff)
    peak  = base * 0.30 if is_peak(hour) else 0
    total = base + peak
    if noise:
        total *= random.uniform(0.85, 1.15)
    return round(max(2.0, min(120.0, total)), 2)


# ── synthetic generator ───────────────────────────────────────────
def generate_synthetic(n_rows: int = 2000):
    """
    Generates realistic synthetic data for Olive's three branches.
    Covers: morning/lunch/evening peaks, weekdays vs weekends,
    different staff counts per shift.
    """
    branches  = ["gulberg", "johar_town", "dha"]
    rows      = []
    start_dt  = datetime(2024, 1, 1, 10, 0)

    for i in range(n_rows):
        # Rotate through days/hours realistically
        dt         = start_dt + timedelta(hours=i * 0.5)
        hour       = dt.hour % 14 + 10          # 10 AM – 11 PM
        day        = dt.weekday()                # 0=Mon … 6=Sun
        branch     = random.choice(branches)

        # Staff count: more on weekends and peak hours
        if day >= 4:                             # Fri–Sun
            staff = random.randint(3, 5)
        elif is_peak(hour):
            staff = random.randint(2, 4)
        else:
            staff = random.randint(2, 3)

        # Queue length: longer on peak hours
        if is_peak(hour) and day >= 4:
            q_len = random.randint(8, 25)
        elif is_peak(hour):
            q_len = random.randint(5, 18)
        else:
            q_len = random.randint(1, 10)

        avg_svc = round(random.uniform(5.0, 12.0), 1)
        wait    = simulate_wait(q_len, avg_svc, hour, staff)

        rows.append({
            "queue_length":      q_len,
            "avg_service_time":  avg_svc,
            "hour_of_day":       hour,
            "day_of_week":       day,
            "staff_count":       staff,
            "branch_id":         branch,
            "actual_wait_minutes": wait
        })

    return rows


# ── kaggle adapter ────────────────────────────────────────────────
def load_kaggle(filepath: str):
    """
    Adapts the Kaggle 'Queue Waiting Time Prediction' CSV
    (columns: Arrival_Time, Service_Start_Time, Service_End_Time, ...)
    to our schema.
    """
    rows = []
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            try:
                # Try to extract hour from arrival time column
                arrival_col = next(
                    (k for k in raw if "arrival" in k.lower() or "time" in k.lower()),
                    None
                )
                hour = 12
                if arrival_col and ":" in str(raw.get(arrival_col, "")):
                    try:
                        hour = int(str(raw[arrival_col]).split(":")[0]) % 24
                    except Exception:
                        hour = 12

                # Try to find wait time column
                wait_col = next(
                    (k for k in raw if "wait" in k.lower() or "duration" in k.lower()),
                    None
                )
                wait = 10.0
                if wait_col:
                    try:
                        wait = float(raw[wait_col])
                    except Exception:
                        pass

                # Try to find queue length column
                q_col = next(
                    (k for k in raw if "queue" in k.lower() or "length" in k.lower()),
                    None
                )
                q_len = random.randint(3, 15)
                if q_col:
                    try:
                        q_len = int(float(raw[q_col]))
                    except Exception:
                        pass

                rows.append({
                    "queue_length":       q_len,
                    "avg_service_time":   round(random.uniform(6, 11), 1),
                    "hour_of_day":        hour,
                    "day_of_week":        random.randint(0, 6),
                    "staff_count":        random.randint(2, 5),
                    "branch_id":          random.choice(["gulberg","johar_town","dha"]),
                    "actual_wait_minutes": min(120.0, max(2.0, wait))
                })
            except Exception as e:
                print(f"  Skipping row: {e}")
                continue
    return rows


# ── main ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="synthetic",
                        choices=["synthetic","kaggle","ieee"])
    parser.add_argument("--file",   default=None,
                        help="Path to downloaded CSV (for kaggle/ieee)")
    parser.add_argument("--rows",   type=int, default=2000,
                        help="Synthetic rows to generate (default 2000)")
    args = parser.parse_args()

    if args.source == "synthetic":
        print(f"Generating {args.rows} synthetic rows...")
        rows = generate_synthetic(args.rows)
    elif args.source in ("kaggle", "ieee"):
        if not args.file or not os.path.exists(args.file):
            print(f"ERROR: --file <path> required for --source {args.source}")
            return
        print(f"Loading {args.source} data from {args.file}...")
        rows = load_kaggle(args.file)
        # Pad with synthetic if too few rows
        if len(rows) < 200:
            print(f"Only {len(rows)} rows from source — padding with synthetic.")
            rows += generate_synthetic(max(200, args.rows - len(rows)))
    else:
        rows = generate_synthetic(args.rows)

    with open(OUTPUT_FILE, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nDone! Wrote {len(rows)} rows to {OUTPUT_FILE}")
    print("Now deploy to Render — the model will use this as bootstrap data.")


if __name__ == "__main__":
    main()
