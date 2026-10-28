from flask import Blueprint, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models import Setting
from app.utils.errors import json_error

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings", methods=["GET"])
def get_settings():
    settings = {item.key: item.value for item in Setting.query.all()}
    defaults = {
        "default_forecast_horizon": "7",
        "demand_lookback_days": "30",
        "default_safety_stock": "10",
        "max_stock_threshold": "150",
        "theme": "light",
    }
    return jsonify({"data": {**defaults, **settings}})


@settings_bp.route("/settings", methods=["POST"])
def save_settings():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return json_error("Settings payload must be an object", 400)
    for key, value in data.items():
        if not isinstance(key, str) or not key.strip() or value is None:
            return json_error("Setting keys must be non-empty and values cannot be null", 400)
        setting = Setting.query.filter_by(key=key).first()
        if setting:
            setting.value = str(value)
        else:
            db.session.add(Setting(key=key, value=str(value)))
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to save settings", 500)
    return jsonify({"data": {"saved": True}})
