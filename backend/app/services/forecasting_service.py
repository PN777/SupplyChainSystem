from datetime import date, datetime, timedelta

import numpy as np

from app.extensions import db
from app.models import DemandRecord, Product
from app.models import Setting


def average_daily_demand_for_product(product_id, lookback_days=30):
    records = DemandRecord.query.filter(DemandRecord.product_id == product_id).order_by(DemandRecord.demand_date.asc()).all()
    if not records:
        return 0.0, 0
    cutoff = datetime.utcnow().date() - timedelta(days=lookback_days)
    filtered = [r for r in records if r.demand_date >= cutoff]
    if not filtered:
        return 0.0, 0
    start = min(r.demand_date for r in filtered)
    end = max(r.demand_date for r in filtered)
    span = (end - start).days + 1
    total = sum(r.quantity for r in filtered)
    return total / max(span, 1), span


def get_forecast_settings():
    settings = {item.key: item.value for item in Setting.query.all()}
    try:
        horizon = max(1, min(90, int(settings.get("default_forecast_horizon", 7))))
    except (TypeError, ValueError):
        horizon = 7
    try:
        lookback_days = max(1, int(settings.get("demand_lookback_days", 30)))
    except (TypeError, ValueError):
        lookback_days = 30
    return {"horizon": horizon, "lookback_days": lookback_days}


def forecast_product(product_id, horizon=7, method="moving_average", lookback_days=30):
    product = db.session.get(Product, product_id)
    records = DemandRecord.query.filter(DemandRecord.product_id == product_id).order_by(DemandRecord.demand_date.asc()).all()
    cutoff = datetime.utcnow().date() - timedelta(days=lookback_days)
    recent_records = [record for record in records if record.demand_date >= cutoff]
    if len(recent_records) < 3:
        recent_records = records
    if not recent_records:
        return {
            "forecast": [],
            "method": method,
            "explanation": "Insufficient historical demand data to generate a forecast.",
            "mae": None,
            "observations": 0,
        }
    start_date = min(record.demand_date for record in recent_records)
    end_date = max(record.demand_date for record in recent_records)
    totals = {}
    for record in recent_records:
        totals[record.demand_date] = totals.get(record.demand_date, 0) + record.quantity
    dates = [start_date + timedelta(days=offset) for offset in range((end_date - start_date).days + 1)]
    values = np.array([totals.get(day, 0) for day in dates], dtype=float)
    if len(values) < 3:
        return {
            "forecast": [],
            "method": method,
            "explanation": "Insufficient date coverage for a forecast after grouping demand by day.",
            "mae": None,
            "observations": len(values),
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
        }
    mean = float(np.mean(values))
    forecast = [mean for _ in range(horizon)]
    forecast_dates = [(end_date + timedelta(days=offset)).isoformat() for offset in range(1, horizon + 1)]
    holdout_size = max(1, len(values) // 5)
    train = values[:-holdout_size]
    holdout = values[-holdout_size:]
    average_predictions = np.full(holdout_size, float(np.mean(train)))
    naive_predictions = values[-holdout_size - 1:-1]
    forecast_mae = float(np.mean(np.abs(holdout - average_predictions)))
    naive_mae = float(np.mean(np.abs(holdout - naive_predictions)))
    total_holdout = float(np.sum(holdout))
    wape = round(float(np.sum(np.abs(holdout - average_predictions)) / max(total_holdout, 1.0) * 100), 1)
    return {
        "forecast": forecast,
        "forecast_dates": forecast_dates,
        "historical_points": [{"date": day.isoformat(), "quantity": float(totals.get(day, 0))} for day in dates],
        "method": method,
        "historical_average": round(mean, 2),
        "explanation": f"Forecast uses daily average demand across {len(values)} calendar days from {start_date.isoformat()} to {end_date.isoformat()}; missing dates are counted as zero.",
        "mae": round(forecast_mae, 2),
        "baseline_mae": round(naive_mae, 2),
        "wape": wape,
        "algorithm": "Daily calendar average baseline with chronological holdout evaluation",
        "limitations": "Estimates assume consumption stability over lookback window. Missing calendar dates count as zero.",
        "is_estimate": True,
        "observations": len(values),
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "units": "units per day",
        "reorder_estimate": round((mean * (product.lead_time_days if product else 0)) + (product.safety_stock if product else 0), 2),
        "lead_time_days": product.lead_time_days if product else None,
        "safety_stock": product.safety_stock if product else None,
    }
