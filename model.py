"""
model.py
========
Self-learning wait-time prediction + branch recommendation.
Automatically retrains as real app data accumulates.
"""

import os
import csv
import json
import math
import pickle
import logging
import numpy as np
from datetime import datetime
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

# ── paths ─────────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH      = os.path.join(BASE_DIR, "wait_time_model.pkl")
SCALER_PATH     = os.path.join(BASE_DIR, "scaler.pkl")
SEED_PATH       = os.path.join(BASE_DIR, "kaggle_seed.csv")
QUEUE_DATA_PATH = os.path.join(BASE_DIR, "queue_data.csv")   # raw real-world data
APP_DATA_PATH   = os.path.join(BASE_DIR, "training_data.csv")
METRICS_PATH    = os.path.join(BASE_DIR, "model_metrics.json")

FIELDNAMES = [
    "queue_length", "avg_service_time", "hour_of_day",
    "day_of_week",  "staff_count",      "branch_id",
    "actual_wait_minutes"
]

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


# ── encoders ─────────────────────────────────────────────────────
BRANCH_MAP = {"gulberg": 0, "johar_town": 1, "dha": 2}

def encode_branch(branch_id: str) -> int:
    return BRANCH_MAP.get(str(branch_id).lower().strip(), 0)

def is_peak(hour: int) -> int:
    """1 if lunch (12-14) or dinner (19-22) peak, else 0."""
    return 1 if (12 <= int(hour) <= 14) or (19 <= int(hour) <= 22) else 0

def is_weekend(day: int) -> int:
    """1 for Friday(4), Saturday(5), Sunday(6)."""
    return 1 if int(day) >= 4 else 0

def build_features(queue_length, avg_service_time, hour_of_day,
                   day_of_week, staff_count=3, branch_id="gulberg"):
    """
    Feature vector (7 features):
    [queue_length, avg_service_time, hour_of_day, day_of_week,
     staff_count, is_peak, is_weekend, branch_encoded]
    """
    return np.array([[
        float(queue_length),
        float(avg_service_time),
        float(hour_of_day),
        float(day_of_week),
        float(staff_count),
        float(is_peak(hour_of_day)),
        float(is_weekend(day_of_week)),
        float(encode_branch(branch_id))
    ]])


# ── data loading ──────────────────────────────────────────────────
def _load_csv(path: str):
    """Load CSV rows as numpy arrays (X, y)."""
    X, y = [], []
    if not os.path.exists(path):
        return np.array(X), np.array(y)

    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                X.append([
                    float(row.get("queue_length",      0)),
                    float(row.get("avg_service_time",  8)),
                    float(row.get("hour_of_day",       12)),
                    float(row.get("day_of_week",       1)),
                    float(row.get("staff_count",       3)),
                    float(is_peak(row.get("hour_of_day", 12))),
                    float(is_weekend(row.get("day_of_week", 1))),
                    float(encode_branch(row.get("branch_id", "gulberg")))
                ])
                y.append(float(row.get("actual_wait_minutes", 10)))
            except (ValueError, KeyError):
                continue

    return np.array(X), np.array(y)


def _load_queue_data_csv(path: str):
    """
    Load queue_data.csv which has columns:
      arrival_time, start_time, finish_time, wait_time, queue_length
    Derives hour_of_day and day_of_week from arrival_time.
    Uses default values for missing fields (avg_service_time, staff_count, branch_id).
    """
    X, y = [], []
    if not os.path.exists(path):
        return np.array(X), np.array(y)

    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                wait = float(row.get("wait_time", 0))
                queue_len = float(row.get("queue_length", 5))

                # Parse arrival_time for temporal features
                hour, day = 12, 1
                raw_time = row.get("arrival_time", "")
                if raw_time:
                    try:
                        from datetime import datetime as _dt
                        # Handles "30-03-2023 0.10" format (fractional hour)
                        parts = raw_time.strip().split()
                        if len(parts) >= 2:
                            frac_hour = float(parts[1])
                            hour = int(frac_hour)
                            date_part = _dt.strptime(parts[0], "%d-%m-%Y")
                            day = date_part.weekday()
                    except Exception:
                        pass

                X.append([
                    queue_len,
                    8.0,                          # default avg_service_time
                    float(hour),
                    float(day),
                    3.0,                          # default staff_count
                    float(is_peak(hour)),
                    float(is_weekend(day)),
                    0.0,                          # default branch_encoded (gulberg)
                ])
                y.append(wait)
            except (ValueError, KeyError):
                continue

    return np.array(X), np.array(y)


def _hardcoded_fallback():
    """Minimal fallback if no CSV exists at all."""
    X = np.array([
        [1, 7, 10, 1, 3, 0, 0, 0], [3, 8, 12, 1, 3, 1, 0, 0],
        [8, 9, 19, 4, 2, 1, 1, 1], [15,10, 20, 5, 2, 1, 1, 2],
        [5, 8, 14, 2, 3, 0, 0, 1], [20,11, 21, 6, 2, 1, 1, 0],
        [10, 9, 18, 3, 3, 1, 0, 2], [2, 7, 11, 0, 4, 0, 0, 1],
        [12, 9, 19, 4, 3, 1, 1, 0], [6, 8, 15, 2, 3, 0, 0, 2],
        [18,10, 20, 5, 2, 1, 1, 1], [4, 7, 13, 1, 4, 0, 0, 0],
        [7, 8, 12, 3, 3, 1, 0, 1], [14, 9, 21, 6, 2, 1, 1, 2],
        [9, 9, 17, 4, 3, 0, 1, 0], [11, 8, 20, 5, 3, 1, 1, 1],
        [16,10, 19, 6, 2, 1, 1, 2], [3, 7, 11, 2, 4, 0, 0, 0],
    ], dtype=float)
    y = np.array([8, 18, 48, 78, 30, 100, 54, 10,
                  64, 34, 90, 22, 40, 72, 44, 58, 84, 14], dtype=float)
    return X, y


# ── training ──────────────────────────────────────────────────────
def train_model() -> dict:
    """
    Train / retrain the model.
    - Loads seed data (Kaggle/synthetic)
    - Loads real app data (logged tokens)
    - Real data gets 3x weight over seed data
    - Saves model + scaler to disk
    - Returns metrics dict
    """
    X_seed,  y_seed  = _load_csv(SEED_PATH)
    X_queue, y_queue = _load_queue_data_csv(QUEUE_DATA_PATH)
    X_app,   y_app   = _load_csv(APP_DATA_PATH)

    seed_count  = len(y_seed) + len(y_queue)
    app_count   = len(y_app)

    # Merge kaggle seed + queue_data as combined seed baseline
    if len(y_seed) > 0 and len(y_queue) > 0:
        X_seed_all = np.vstack([X_seed, X_queue])
        y_seed_all = np.concatenate([y_seed, y_queue])
    elif len(y_queue) > 0:
        X_seed_all, y_seed_all = X_queue, y_queue
    else:
        X_seed_all, y_seed_all = X_seed, y_seed

    if app_count >= 10:
        # Real app data 3x weighted over seed
        X = np.vstack([X_seed_all, X_app, X_app, X_app]) if seed_count > 0 \
            else np.vstack([X_app, X_app, X_app])
        y = np.concatenate([y_seed_all, y_app, y_app, y_app]) if seed_count > 0 \
            else np.concatenate([y_app, y_app, y_app])
        source = f"seed={seed_count} (kaggle+queue_data) + real={app_count} (real 3x weighted)"
    elif seed_count > 0:
        X, y   = X_seed_all, y_seed_all
        source = f"seed only ({seed_count} rows: kaggle_seed + queue_data) — waiting for real data"
    else:
        X, y   = _hardcoded_fallback()
        source = "hardcoded fallback — run generate_seed_data.py!"
        log.warning("No seed data found — using hardcoded fallback!")

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train/test split for metrics
    if len(y) >= 20:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X_scaled, y, test_size=0.15, random_state=42
        )
        model = LinearRegression()
        model.fit(X_tr, y_tr)
        y_pred = model.predict(X_te)
        mae = float(mean_absolute_error(y_te, y_pred))
    else:
        model = LinearRegression()
        model.fit(X_scaled, y)
        y_pred = model.predict(X_scaled)
        mae = float(mean_absolute_error(y, y_pred))

    # Save model and scaler
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)

    metrics = {
        "trained_at":        datetime.utcnow().isoformat() + "Z",
        "source":            source,
        "total_samples":     len(y),
        "seed_samples":      seed_count,
        "queue_data_samples": len(y_queue),
        "real_samples":      app_count,
        "mae_minutes":       round(mae, 2),
        "model_type":        "LinearRegression",
        "features":          [
            "queue_length", "avg_service_time", "hour_of_day",
            "day_of_week",  "staff_count",      "is_peak",
            "is_weekend",   "branch_encoded"
        ]
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    log.info(f"Model trained — MAE: {mae:.2f} min | "
             f"Samples: {len(y)} ({source})")
    return metrics


def load_model_and_scaler():
    """Load from disk, train if missing."""
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        with open(SCALER_PATH, "rb") as f:
            scaler = pickle.load(f)
        return model, scaler

    log.info("No saved model found — training now...")
    train_model()
    return load_model_and_scaler()


# ── prediction ────────────────────────────────────────────────────
def predict_wait_time(queue_length: int,
                      avg_service_time: float,
                      hour_of_day: int,
                      day_of_week: int,
                      staff_count: int   = 3,
                      branch_id: str     = "gulberg") -> float:
    """
    Returns predicted wait time in minutes.
    Clamped between 2 and 120 minutes.
    """
    model, scaler = load_model_and_scaler()
    features      = build_features(
        queue_length, avg_service_time, hour_of_day,
        day_of_week, staff_count, branch_id
    )
    scaled   = scaler.transform(features)
    raw_pred = model.predict(scaled)[0]
    return round(max(2.0, min(120.0, float(raw_pred))), 1)


# ── branch recommendation ─────────────────────────────────────────
def haversine(lat1, lng1, lat2, lng2) -> float:
    """Straight-line distance in km between two GPS points."""
    R     = 6371.0
    dlat  = math.radians(lat2 - lat1)
    dlng  = math.radians(lng2 - lng1)
    a     = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(lat1))
             * math.cos(math.radians(lat2))
             * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def recommend_branch(branches: list,
                     user_lat: float,
                     user_lng: float,
                     hour_of_day: int  = 12,
                     day_of_week: int  = 1) -> dict:
    """
    Score each branch and return ranked list.

    branches: list of dicts with keys:
        id, name, queue_length, avg_service_time,
        staff_count, lat, lng

    Scoring:
        score = (predicted_wait * 0.65) + (distance_km * 0.35)
        Lower score = better recommendation
    """
    scored = []
    for branch in branches:
        wait = predict_wait_time(
            queue_length     = int(branch.get("queue_length",     5)),
            avg_service_time = float(branch.get("avg_service_time", 8.0)),
            hour_of_day      = hour_of_day,
            day_of_week      = day_of_week,
            staff_count      = int(branch.get("staff_count",      3)),
            branch_id        = str(branch.get("id", "gulberg"))
        )
        dist  = haversine(
            user_lat, user_lng,
            float(branch.get("lat", user_lat)),
            float(branch.get("lng", user_lng))
        )
        score = (wait * 0.65) + (dist * 0.35)

        scored.append({
            "branch_id":       branch.get("id"),
            "branch_name":     branch.get("name"),
            "queue_length":    branch.get("queue_length"),
            "estimated_wait":  wait,
            "distance_km":     round(dist, 2),
            "score":           round(score, 2),
            "recommended":     False,
            "wait_range":      f"{max(1, int(wait)-3)}–{int(wait)+3} min"
        })

    scored.sort(key=lambda x: x["score"])
    if scored:
        scored[0]["recommended"] = True

    return {"branches": scored, "best": scored[0] if scored else None}


# ── data logging ──────────────────────────────────────────────────
def log_served_token(data: dict) -> int:
    """
    Append one real token to training_data.csv.
    Returns total row count.
    Retrains automatically every RETRAIN_EVERY rows.
    """
    RETRAIN_EVERY = 50

    required = ["queue_length", "avg_service_time", "hour_of_day",
                "day_of_week",  "actual_wait_minutes"]
    for key in required:
        if key not in data:
            raise ValueError(f"Missing required field: {key}")

    row = {
        "queue_length":       data["queue_length"],
        "avg_service_time":   data.get("avg_service_time",  8.0),
        "hour_of_day":        data["hour_of_day"],
        "day_of_week":        data["day_of_week"],
        "staff_count":        data.get("staff_count",        3),
        "branch_id":          data.get("branch_id",          "gulberg"),
        "actual_wait_minutes": data["actual_wait_minutes"]
    }

    file_exists = os.path.exists(APP_DATA_PATH)
    with open(APP_DATA_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)

    total = _count_rows(APP_DATA_PATH)
    log.info(f"Logged token — total real samples: {total}")

    if total % RETRAIN_EVERY == 0:
        log.info(f"Hit {total} samples — auto-retraining...")
        train_model()

    return total


def _count_rows(path: str) -> int:
    if not os.path.exists(path):
        return 0
    with open(path) as f:
        return max(0, sum(1 for _ in f) - 1)


def get_metrics() -> dict:
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH) as f:
            return json.load(f)
    return {"error": "Model not trained yet — call /train first"}


# ── main (train from command line) ────────────────────────────────
if __name__ == "__main__":
    print("Training model...")
    m = train_model()
    print(json.dumps(m, indent=2))
