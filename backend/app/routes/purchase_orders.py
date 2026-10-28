from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models import Product, PurchaseOrder, PurchaseOrderItem, StockMovement, Supplier
from app.utils.errors import json_error
from app.utils.validators import ensure_valid_date, is_non_negative_number, is_positive_int

purchase_orders_bp = Blueprint("purchase_orders", __name__)

VALID_TRANSITIONS = {
    "Draft": ["Pending", "Cancelled"],
    "Pending": ["Approved", "Cancelled"],
    "Approved": ["Shipped", "Cancelled"],
    "Shipped": ["Received", "Cancelled"],
    "Received": [],
    "Cancelled": [],
}


@purchase_orders_bp.route("/purchase-orders", methods=["GET"])
def list_purchase_orders():
    query = PurchaseOrder.query
    status = request.args.get("status")
    supplier_id = request.args.get("supplier_id", type=int)
    search = request.args.get("search", "").strip()

    if status and status != "all":
        query = query.filter(PurchaseOrder.status == status)
    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    if search:
        query = query.join(Supplier, isouter=True).filter(
            or_(
                PurchaseOrder.id.like(f"%{search}%"),
                PurchaseOrder.status.ilike(f"%{search}%"),
                Supplier.name.ilike(f"%{search}%"),
            )
        )
    orders = query.order_by(PurchaseOrder.order_date.desc()).all()
    return jsonify({"data": [order.to_dict() for order in orders]})


@purchase_orders_bp.route("/purchase-orders/<int:id>", methods=["GET"])
def get_purchase_order(id):
    order = db.session.get(PurchaseOrder, id)
    if not order:
        return json_error("Purchase order not found", 404)
    return jsonify({"data": order.to_dict()})


@purchase_orders_bp.route("/purchase-orders", methods=["POST"])
def create_purchase_order():
    data = request.get_json(silent=True) or {}
    supplier_id = data.get("supplier_id")
    if supplier_id in (None, ""):
        return json_error("Supplier is required", 400)
    items = data.get("items") or []
    if not items:
        return json_error("At least one item is required", 400)

    try:
        supplier_id = int(supplier_id)
    except (ValueError, TypeError):
        return json_error("Invalid supplier_id", 400)

    if not db.session.get(Supplier, supplier_id):
        return json_error("Supplier not found", 404)
    try:
        order_date = ensure_valid_date(data.get("order_date")) or datetime.utcnow().date()
        expected_delivery_date = ensure_valid_date(data.get("expected_delivery_date"))
    except (TypeError, ValueError):
        return json_error("Dates must use ISO format (YYYY-MM-DD)", 400)
    requested_status = data.get("status", "Pending")
    if requested_status not in {"Draft", "Pending"}:
        return json_error("New purchase orders may only be Draft or Pending", 400)
    order = PurchaseOrder(
        supplier_id=supplier_id,
        order_date=order_date,
        expected_delivery_date=expected_delivery_date,
        status=requested_status,
    )
    db.session.add(order)
    db.session.flush()

    total = 0.0
    for item in items:
        product_id = item.get("product_id")
        product = db.session.get(Product, product_id)
        if not product:
            db.session.rollback()
            return json_error(f"Product {product_id} not found", 404)
        try:
            quantity = is_positive_int(item.get("quantity", 0), "Item quantity")
        except (TypeError, ValueError) as exc:
            db.session.rollback()
            return json_error(str(exc), 400)
        if quantity <= 0:
            db.session.rollback()
            return json_error("Item quantity must be positive", 400)
        try:
            unit_cost = is_non_negative_number(
                item.get("unit_cost") if item.get("unit_cost") is not None else product.unit_cost,
                "Item unit_cost",
            )
        except (TypeError, ValueError) as exc:
            db.session.rollback()
            return json_error(str(exc), 400)
        line_total = quantity * unit_cost
        total += line_total
        db.session.add(PurchaseOrderItem(
            purchase_order_id=order.id,
            product_id=product.id,
            quantity=quantity,
            unit_cost=unit_cost,
        ))

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to create purchase order", 500)
    return jsonify({"data": order.to_dict(), "total": total}), 201


@purchase_orders_bp.route("/purchase-orders/<int:id>", methods=["PUT"])
def update_purchase_order(id):
    order = db.session.get(PurchaseOrder, id)
    if not order:
        return json_error("Purchase order not found", 404)
    if order.status in ("Received", "Cancelled"):
        return json_error(f"Cannot edit order with status {order.status}", 400)

    data = request.get_json(silent=True) or {}

    # If Approved or Shipped, only allow updating expected delivery date
    if order.status in ("Approved", "Shipped"):
        if "expected_delivery_date" in data:
            try:
                order.expected_delivery_date = ensure_valid_date(data.get("expected_delivery_date"))
            except (TypeError, ValueError):
                return json_error("Invalid expected_delivery_date format", 400)
        try:
            db.session.commit()
            return jsonify({"data": order.to_dict()})
        except SQLAlchemyError:
            db.session.rollback()
            return json_error("Unable to update purchase order", 500)

    # For Draft or Pending, permit full edit of supplier, dates, items
    if "supplier_id" in data and data["supplier_id"]:
        try:
            supplier_id = int(data["supplier_id"])
            if not db.session.get(Supplier, supplier_id):
                return json_error("Supplier not found", 404)
            order.supplier_id = supplier_id
        except (ValueError, TypeError):
            return json_error("Invalid supplier_id", 400)

    if "order_date" in data:
        try:
            order.order_date = ensure_valid_date(data["order_date"]) or order.order_date
        except (TypeError, ValueError):
            return json_error("Invalid order_date format", 400)

    if "expected_delivery_date" in data:
        try:
            order.expected_delivery_date = ensure_valid_date(data["expected_delivery_date"])
        except (TypeError, ValueError):
            return json_error("Invalid expected_delivery_date format", 400)

    if "status" in data and data["status"] in ("Draft", "Pending"):
        order.status = data["status"]

    if "items" in data:
        items = data["items"]
        if not items:
            return json_error("At least one item is required", 400)
        
        # Clear existing items and replace
        order.items.clear()
        db.session.flush()

        for item in items:
            product = db.session.get(Product, item.get("product_id"))
            if not product:
                db.session.rollback()
                return json_error(f"Product {item.get('product_id')} not found", 404)
            try:
                quantity = is_positive_int(item.get("quantity", 0), "Item quantity")
            except (TypeError, ValueError) as exc:
                db.session.rollback()
                return json_error(str(exc), 400)
            try:
                unit_cost = is_non_negative_number(
                    item.get("unit_cost") if item.get("unit_cost") is not None else product.unit_cost,
                    "Item unit_cost",
                )
            except (TypeError, ValueError) as exc:
                db.session.rollback()
                return json_error(str(exc), 400)
            db.session.add(PurchaseOrderItem(
                purchase_order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_cost=unit_cost,
            ))

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to update purchase order", 500)
    return jsonify({"data": order.to_dict()})


@purchase_orders_bp.route("/purchase-orders/<int:id>/receive", methods=["POST"])
def receive_purchase_order(id):
    order = db.session.get(PurchaseOrder, id)
    if not order:
        return json_error("Purchase order not found", 404)
    if order.status == "Received":
        return json_error("Order already received", 400)
    if order.status == "Cancelled":
        return json_error("Cancelled orders cannot be received", 400)
    if order.status == "Draft":
        return json_error("Draft orders must be approved or shipped before receiving", 400)
    if StockMovement.query.filter_by(purchase_order_id=order.id).first():
        return json_error("Order has already created stock movements", 400)
    if not order.items:
        return json_error("Order has no items to receive", 400)

    data = request.get_json(silent=True) or {}
    try:
        received_date = ensure_valid_date(data.get("received_date")) or datetime.utcnow().date()
    except (TypeError, ValueError):
        return json_error("Invalid received_date format (YYYY-MM-DD)", 400)

    try:
        for item in order.items:
            product = db.session.get(Product, item.product_id)
            if not product:
                raise ValueError(f"Product {item.product_id} not found")
            db.session.add(StockMovement(
                product_id=item.product_id,
                movement_date=received_date,
                movement_type="Stock In",
                quantity=item.quantity,
                reference=f"PO-{order.id}",
                description=f"Received from supplier PO #{order.id}",
                purchase_order_id=order.id,
            ))
        order.received_date = received_date
        order.status = "Received"
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return json_error(str(exc), 400)
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to receive purchase order", 500)
    return jsonify({"data": order.to_dict(), "message": "Purchase order received and stock updated."})


@purchase_orders_bp.route("/purchase-orders/<int:id>/cancel", methods=["POST"])
def cancel_purchase_order(id):
    order = db.session.get(PurchaseOrder, id)
    if not order:
        return json_error("Purchase order not found", 404)
    if order.status == "Received":
        return json_error("Received orders cannot be cancelled", 400)
    if order.status == "Cancelled":
        return json_error("Order already cancelled", 400)
    order.status = "Cancelled"
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to cancel purchase order", 500)
    return jsonify({"data": order.to_dict(), "message": "Purchase order cancelled."})


@purchase_orders_bp.route("/purchase-orders/<int:id>", methods=["DELETE"])
def delete_purchase_order(id):
    """
    Permanently delete a purchase order.
    Only Cancelled or Draft orders may be deleted.
    Received orders cannot be deleted because they have created stock movements
    that are part of the inventory audit trail.
    """
    order = db.session.get(PurchaseOrder, id)
    if not order:
        return json_error("Purchase order not found", 404)
    if order.status == "Received":
        return json_error(
            "Received orders cannot be deleted because they have created stock movements. "
            "Cancel the order first if you need to reverse it.",
            400,
        )
    if order.status not in ("Cancelled", "Draft", "Pending"):
        return json_error(
            f"Only Draft, Pending, or Cancelled orders can be deleted (current status: {order.status}).",
            400,
        )
    try:
        # Cascade deletes PurchaseOrderItems automatically via relationship
        db.session.delete(order)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to delete purchase order", 500)
    return jsonify({"message": f"Purchase order PO-{id} deleted."})


@purchase_orders_bp.route("/purchase-orders/<int:id>/status", methods=["PATCH"])
def update_status(id):
    order = db.session.get(PurchaseOrder, id)
    if not order:
        return json_error("Purchase order not found", 404)
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if new_status not in VALID_TRANSITIONS.get(order.status, []):
        return json_error(f"Invalid transition from {order.status} to {new_status}", 400)
    if new_status == "Received":
        return receive_purchase_order(id)
    if new_status == "Cancelled":
        return cancel_purchase_order(id)
    order.status = new_status
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to update purchase-order status", 500)
    return jsonify({"data": order.to_dict()})
