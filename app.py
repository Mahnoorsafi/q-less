"""
app.py
======
Q-Less AI Flask API — deploy on Render.com (free tier)

Endpoints:
    GET  /health          — status + model metrics
    POST /predict         — predict wait time
    POST /recommend       — recommend best branch
    POST /log             — log real token data (feeds retraining)
    POST /train           — manually trigger retrain
    GET  /metrics         — model accuracy metrics
    GET  /data/stats      — training data statistics
"""

import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from apscheduler.schedulers.background import BackgroundScheduler

from model import (
    predict_wait_time,
    recommend_branch,
    log_served_token,
    train_model,
    get_metrics,
    _count_rows,
    APP_DATA_PATH,
    SEED_PATH,
    QUEUE_DATA_PATH,
)

# ── setup ─────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)


# ── nightly auto-retrain at 2:00 AM UTC ──────────────────────────
def nightly_retrain():
    log.info("Nightly retrain starting...")
    try:
        metrics = train_model()
        log.info(f"Nightly retrain done. MAE={metrics['mae_minutes']} min | "
                 f"Samples={metrics['total_samples']}")
    except Exception as e:
        log.error(f"Nightly retrain failed: {e}")

scheduler = BackgroundScheduler(timezone="UTC")
scheduler.add_job(nightly_retrain, "cron", hour=2, minute=0)
scheduler.start()


# ── routes ────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    """Root — redirects to /health for quick browser check."""
    from flask import redirect
    return redirect("/health")


@app.route("/health", methods=["GET"])
def health():
    """Health check — called by Render to keep alive."""
    metrics = get_metrics()
    return jsonify({
        "status":             "ok",
        "app":                "Q-Less AI",
        "timestamp":          datetime.utcnow().isoformat() + "Z",
        "real_samples":       _count_rows(APP_DATA_PATH),
        "seed_samples":       _count_rows(SEED_PATH),
        "queue_data_samples": _count_rows(QUEUE_DATA_PATH),
        "model":              metrics
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Predict wait time for a customer.

    Request JSON:
    {
        "queue_length":     12,
        "avg_service_time": 8.5,
        "hour_of_day":      19,
        "day_of_week":      4,
        "staff_count":      3,
        "branch_id":        "gulberg"
    }

    Response JSON:
    {
        "estimated_wait_minutes": 18.4,
        "wait_range":             "15–21 min",
        "is_peak_hour":           true
    }
    """
    d = request.get_json(force=True)
    if not d:
        return jsonify({"error": "JSON body required"}), 400

    try:
        from datetime import datetime as dt
        now = dt.utcnow()

        queue_length     = int(d.get("queue_length",     0))
        avg_service_time = float(d.get("avg_service_time", 8.0))
        hour_of_day      = int(d.get("hour_of_day",     now.hour))
        day_of_week      = int(d.get("day_of_week",     now.weekday()))
        staff_count      = int(d.get("staff_count",     3))
        branch_id        = str(d.get("branch_id",       "gulberg"))

        wait = predict_wait_time(
            queue_length, avg_service_time, hour_of_day,
            day_of_week, staff_count, branch_id
        )
        peak = (12 <= hour_of_day <= 14) or (19 <= hour_of_day <= 22)

        return jsonify({
            "estimated_wait_minutes": wait,
            "wait_range":   f"{max(1, int(wait)-3)}–{int(wait)+3} min",
            "is_peak_hour": peak
        })

    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid input: {e}"}), 400
    except Exception as e:
        log.error(f"/predict error: {e}")
        return jsonify({"error": "Prediction failed"}), 500


@app.route("/recommend", methods=["POST"])
def recommend():
    """
    Recommend the best branch for a customer.

    Request JSON:
    {
        "user_lat":   31.5204,
        "user_lng":   74.3587,
        "hour_of_day": 19,
        "day_of_week": 4,
        "branches": [
            {
                "id":               "gulberg",
                "name":             "Olive Gulberg",
                "queue_length":     12,
                "avg_service_time": 8.5,
                "staff_count":      3,
                "lat":              31.5204,
                "lng":              74.3587
            },
            ...
        ]
    }
    """
    d = request.get_json(force=True)
    if not d:
        return jsonify({"error": "JSON body required"}), 400

    branches = d.get("branches", [])
    if not branches:
        return jsonify({"error": "branches list is required"}), 400

    try:
        from datetime import datetime as dt
        now = dt.utcnow()

        result = recommend_branch(
            branches    = branches,
            user_lat    = float(d.get("user_lat",    0.0)),
            user_lng    = float(d.get("user_lng",    0.0)),
            hour_of_day = int(d.get("hour_of_day",  now.hour)),
            day_of_week = int(d.get("day_of_week",  now.weekday()))
        )
        return jsonify(result)

    except Exception as e:
        log.error(f"/recommend error: {e}")
        return jsonify({"error": "Recommendation failed"}), 500


@app.route("/log", methods=["POST"])
def log_token():
    """
    Log a real served token — this is how the model learns.
    Call this from Android when admin marks a token as SERVED.

    Request JSON:
    {
        "queue_length":         12,
        "avg_service_time":     8.5,
        "hour_of_day":          19,
        "day_of_week":          4,
        "staff_count":          3,
        "branch_id":            "gulberg",
        "actual_wait_minutes":  22.5
    }
    """
    d = request.get_json(force=True)
    if not d:
        return jsonify({"error": "JSON body required"}), 400

    try:
        total = log_served_token(d)
        retrained = (total % 50 == 0)
        return jsonify({
            "status":           "logged",
            "total_real_samples": total,
            "auto_retrained":   retrained,
            "message":          f"Model retrained! {total} samples" if retrained
                                else f"Logged. {50 - (total % 50)} more until retrain."
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        log.error(f"/log error: {e}")
        return jsonify({"error": "Logging failed"}), 500


@app.route("/train", methods=["POST"])
def manual_train():
    """Manually trigger a full model retrain."""
    try:
        metrics = train_model()
        return jsonify({"status": "ok", "metrics": metrics})
    except Exception as e:
        log.error(f"/train error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/metrics", methods=["GET"])
def metrics():
    """Return current model accuracy metrics."""
    return jsonify(get_metrics())


@app.route("/data/stats", methods=["GET"])
def data_stats():
    """Return training data statistics."""
    real  = _count_rows(APP_DATA_PATH)
    seed  = _count_rows(SEED_PATH)
    return jsonify({
        "real_samples":  real,
        "seed_samples":  seed,
        "total_samples": real + seed,
        "next_retrain_at": f"Every {50 - (real % 50)} more real samples, "
                           f"or tonight at 2:00 AM UTC"
    })


# ── entry point ───────────────────────────────────────────────────
if __name__ == "__main__":
    # Train on startup if no model exists yet
    import os
    from model import MODEL_PATH
    if not os.path.exists(MODEL_PATH):
        log.info("No model found on startup — training now...")
        train_model()

    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
