from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import and_, or_
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models import Product, StockMovement
from app.utils.errors import json_error
from app.utils.validators import ensure_valid_date, is_positive_int

inventory_bp = Blueprint("inventory", __name__)


@inventory_bp.route("/stock/movements", methods=["GET"])
def list_movements():
    product_id = request.args.get("product_id", type=int)
    movement_type = request.args.get("movement_type")
    query = StockMovement.query
    if product_id:
        query = query.filter_by(product_id=product_id)
    if movement_type:
        query = query.filter_by(movement_type=movement_type)
    movements = query.order_by(StockMovement.movement_date.desc()).all()
    return jsonify({"data": [movement.to_dict() for movement in movements]})


@inventory_bp.route("/stock/movements/<int:movement_id>/receipt", methods=["GET"])
def movement_receipt(movement_id):
    movement = db.session.get(StockMovement, movement_id)
    if not movement:
        return json_error("Stock movement not found", 404)

    prior_movements = (
        StockMovement.query
        .filter(
            StockMovement.product_id == movement.product_id,
            or_(
                StockMovement.created_at < movement.created_at,
                and_(
                    StockMovement.created_at == movement.created_at,
                    StockMovement.id < movement.id,
                ),
            ),
        )
        .order_by(StockMovement.created_at.asc(), StockMovement.id.asc())
        .all()
    )
    before = sum(item.delta() for item in prior_movements)
    after = before + movement.delta()
    payload = movement.to_dict()
    payload.update({
        "unit_cost": float(movement.product.unit_cost),
        "stock_before": before,
        "stock_after": after,
        "stock_quantities_available": True,
    })
    return jsonify({"data": payload})


@inventory_bp.route("/stock/movements", methods=["POST"])
def create_movement():
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    movement_type = data.get("movement_type")
    quantity_raw = data.get("quantity")
    if not product_id or not movement_type or quantity_raw is None:
        return json_error("product_id, movement_type, and quantity are required", 400)

    product = db.session.get(Product, product_id)
    if not product:
        return json_error("Product not found", 404)

    if movement_type not in {"Stock In", "Stock Out", "Return", "Adjustment", "Opening Stock"}:
        return json_error("Unsupported movement type", 400)

    try:
        movement_date = ensure_valid_date(data.get("movement_date")) or datetime.utcnow().date()
    except (TypeError, ValueError) as exc:
        return json_error(str(exc), 400)

    if movement_type == "Adjustment":
        try:
            quantity = int(quantity_raw)
        except (TypeError, ValueError):
            return json_error("Adjustment quantity must be an integer", 400)
        if quantity == 0:
            return json_error("Adjustment quantity cannot be zero", 400)
        if product.current_stock + quantity < 0:
            return json_error("Adjustment would reduce stock below zero", 400)
    else:
        try:
            quantity = is_positive_int(quantity_raw, "Quantity")
        except (TypeError, ValueError) as exc:
            return json_error(str(exc), 400)
        if quantity <= 0:
            return json_error("Quantity must be positive", 400)
        if movement_type == "Stock Out":
            current = product.current_stock
            if current - quantity < 0:
                return json_error("Cannot reduce stock below zero", 400)

    if data.get("reference") is not None and len(str(data["reference"])) > 100:
        return json_error("Reference must be at most 100 characters", 400)

    reference = data.get("reference") or f"manual-{movement_type.lower().replace(' ', '-')}"
    movement = StockMovement(
        product_id=product.id,
        movement_date=movement_date,
        movement_type=movement_type,
        quantity=quantity,
        reference=reference,
        description=data.get("description"),
    )
    try:
        db.session.add(movement)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to persist stock movement")
        return json_error("Unable to record stock movement", 500)
    return jsonify({"data": movement.to_dict()}), 201


@inventory_bp.route("/stock/summary", methods=["GET"])
def stock_summary():
    search = request.args.get("search", "").strip()
    include_archived = request.args.get("include_archived", "").lower() in ("true", "1")
    query = Product.query
    if not include_archived:
        query = query.filter(Product.is_active == True)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Product.name.ilike(term), Product.sku.ilike(term)))
    products = []
    for product in query.order_by(Product.name.asc()).all():
        products.append({
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "category": product.category,
            "unit_cost": float(product.unit_cost),
            "stock": product.current_stock,
            "reorder_point": product.reorder_point,
            "safety_stock": product.safety_stock,
            "max_stock": product.max_stock,
            "is_active": product.is_active,
        })
    return jsonify({"products": products})


@inventory_bp.route("/stock/alerts", methods=["GET"])
def stock_alerts():
    include_archived = request.args.get("include_archived", "").lower() in ("true", "1")
    query = Product.query
    if not include_archived:
        query = query.filter(Product.is_active == True)
    alerts = []
    for product in query.all():
        stock = product.current_stock
        if stock <= 0:
            status = "OUT_OF_STOCK"
        elif stock <= product.reorder_point:
            status = "LOW_STOCK"
        elif product.max_stock and stock > product.max_stock:
            status = "EXCESS_STOCK"
        else:
            status = "OK"
        if status != "OK":
            alerts.append({
                "product_id": product.id,
                "product_name": product.name,
                "sku": product.sku,
                "current_stock": stock,
                "reorder_point": product.reorder_point,
                "status": status,
            })
    return jsonify({"data": alerts})
