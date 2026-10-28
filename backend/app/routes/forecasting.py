from flask import Blueprint, jsonify, request
from app.extensions import db

from app.models import DemandRecord, Product
from app.services.forecasting_service import forecast_product, get_forecast_settings
from app.utils.errors import json_error

forecasting_bp = Blueprint("forecasting", __name__)


@forecasting_bp.route("/forecast", methods=["GET"])
def get_forecast():
    product_id = request.args.get("product_id", type=int)
    if not product_id:
        return json_error("product_id is required", 400)
    product = db.session.get(Product, product_id)
    if not product:
        return json_error("Product not found", 404)
    settings = get_forecast_settings()
    horizon = request.args.get("horizon", settings["horizon"], type=int)
    if horizon < 1 or horizon > 90:
        return json_error("horizon must be between 1 and 90", 400)
    result = forecast_product(product_id, horizon=horizon, lookback_days=settings["lookback_days"])
    return jsonify({"data": {"product_id": product_id, "product_name": product.name, **result}})


@forecasting_bp.route("/forecast/<int:product_id>", methods=["GET"])
def get_product_forecast(product_id):
    product = db.session.get(Product, product_id)
    if not product:
        return json_error("Product not found", 404)
    settings = get_forecast_settings()
    result = forecast_product(product_id, horizon=settings["horizon"], lookback_days=settings["lookback_days"])
    return jsonify({"data": {"product_id": product_id, "product_name": product.name, **result}})


@forecasting_bp.route("/forecast/evaluation", methods=["GET"])
def forecast_evaluation():
    product_id = request.args.get("product_id", type=int)
    if not product_id:
        return json_error("product_id is required", 400)
    product = db.session.get(Product, product_id)
    if not product:
        return json_error("Product not found", 404)
    records = DemandRecord.query.filter_by(product_id=product_id).order_by(DemandRecord.demand_date.asc()).all()
    result = forecast_product(product_id, horizon=1, lookback_days=10_000)
    if result.get("mae") is None:
        return jsonify({"data": {"product_id": product_id, "metric": None, "message": "Insufficient historical data for evaluation."}})
    return jsonify({"data": {
        "product_id": product_id,
        "metric": result["mae"],
        "metric_name": "mae",
        "naive_baseline_mae": result.get("baseline_mae"),
        "observations": result.get("observations"),
        "period_start": result.get("period_start"),
        "period_end": result.get("period_end"),
    }})
