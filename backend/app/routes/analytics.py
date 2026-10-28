from flask import Blueprint, jsonify, request
from sqlalchemy import func, select

from app.extensions import db
from app.models import DemandRecord, Product, PurchaseOrder, StockMovement, Supplier

analytics_bp = Blueprint("analytics", __name__)


def _product_has_stock_movements(product_id_set: set[int]) -> set[int]:
    """Return the set of product IDs that have at least one stock movement.
    Used to distinguish "never stocked" (new) products from true stockouts.
    """
    if not product_id_set:
        return set()
    rows = (
        db.session.execute(
            select(StockMovement.product_id)
            .where(StockMovement.product_id.in_(product_id_set))
            .distinct()
        )
        .scalars()
        .all()
    )
    return set(rows)


@analytics_bp.route("/analytics/dashboard", methods=["GET"])
def dashboard_analytics():
    products = Product.query.filter_by(is_active=True).all()

    if not products:
        return jsonify({
            "data": {
                "total_products": 0,
                "total_inventory_value": 0,
                "low_stock_products": 0,
                "out_of_stock_products": 0,
                "pending_purchase_orders": 0,
                "average_supplier_lead_time": 0,
                "total_demand": 0,
                "demand_trend": [],
                "stock_movement_trend": [],
                "supplier_performance": [],
            }
        })

    product_ids = {p.id for p in products}
    stocked_ids = _product_has_stock_movements(product_ids)

    total_inventory_value = sum(p.current_stock * p.unit_cost for p in products)

    # Low stock: stock is positive but at or below reorder point (reorder point must be > 0)
    low_stock_count = sum(
        1 for p in products
        if p.current_stock > 0
        and p.reorder_point > 0
        and p.current_stock <= p.reorder_point
    )

    # Stockout: product has been stocked before (has movements) AND is now at or below zero
    out_of_stock_count = sum(
        1 for p in products
        if p.id in stocked_ids and p.current_stock <= 0
    )

    pending_orders = PurchaseOrder.query.filter(
        PurchaseOrder.status.in_(["Pending", "Approved", "Shipped"])
    ).count()

    average_lead_time = (
        round(sum(p.lead_time_days for p in products) / len(products), 2)
        if products else 0
    )

    total_demand = (
        db.session.execute(select(func.coalesce(func.sum(DemandRecord.quantity), 0)))
        .scalar()
    )

    # Demand grouped by date — all records, newest observations last
    recent_records = DemandRecord.query.order_by(DemandRecord.demand_date.asc()).all()
    demand_by_date: dict = {}
    for record in recent_records:
        key = record.demand_date.isoformat()
        demand_by_date[key] = demand_by_date.get(key, 0) + record.quantity
    recent_demand = [
        {"date": d, "quantity": q}
        for d, q in sorted(demand_by_date.items())
    ]
    # Cap at 30 most recent observation points
    if len(recent_demand) > 30:
        recent_demand = recent_demand[-30:]

    movement_trends = [
        {
            "date": m.movement_date.isoformat(),
            "type": m.movement_type,
            "quantity": m.quantity,
        }
        for m in reversed(
            StockMovement.query.order_by(StockMovement.movement_date.desc()).limit(25).all()
        )
    ]

    supplier_performance = []
    for supplier in Supplier.query.filter_by(is_active=True).order_by(Supplier.name.asc()).all():
        orders = PurchaseOrder.query.filter_by(supplier_id=supplier.id).all()
        eligible = [
            o for o in orders
            if o.status == "Received" and o.received_date and o.expected_delivery_date
        ]
        on_time = sum(1 for o in eligible if o.received_date <= o.expected_delivery_date)
        pct = round((on_time / len(eligible)) * 100, 1) if eligible else None
        supplier_performance.append({
            "supplier": supplier.name,
            "supplier_id": supplier.id,
            "on_time_delivery": pct,
            "delivered_orders": len(eligible),
            "on_time_orders": on_time,
            "total_orders": len(orders),
        })

    return jsonify({
        "data": {
            "total_products": len(products),
            "total_inventory_value": round(total_inventory_value, 2),
            "low_stock_products": low_stock_count,
            "out_of_stock_products": out_of_stock_count,
            "pending_purchase_orders": pending_orders,
            "average_supplier_lead_time": average_lead_time,
            "total_demand": int(total_demand),
            "demand_trend": recent_demand,
            "stock_movement_trend": movement_trends,
            "supplier_performance": supplier_performance,
        }
    })


@analytics_bp.route("/analytics/inventory", methods=["GET"])
def inventory_analytics():
    include_archived = request.args.get("include_archived", "").lower() in ("true", "1")
    query = Product.query
    if not include_archived:
        query = query.filter_by(is_active=True)
    products = query.order_by(Product.name.asc()).all()

    product_ids = {p.id for p in products}
    stocked_ids = _product_has_stock_movements(product_ids)

    chart = []
    for p in products:
        stock = p.current_stock
        stock_value = round(stock * p.unit_cost, 2)
        chart.append({
            "id": p.id,
            "product": p.name,
            "sku": p.sku,
            "stock": stock,
            "unit_cost": float(p.unit_cost),
            "stock_value": stock_value,
            "is_active": p.is_active,
            "ever_stocked": p.id in stocked_ids,
        })

    # Sort by stock_value descending; only include products with actual value > 0
    # (products with 0 stock contribute nothing to valuation)
    chart = sorted(
        [row for row in chart if row["stock_value"] > 0],
        key=lambda r: r["stock_value"],
        reverse=True,
    )

    return jsonify({"data": {"chart": chart}})


@analytics_bp.route("/analytics/suppliers", methods=["GET"])
def suppliers_analytics():
    include_archived = request.args.get("include_archived", "").lower() in ("true", "1")
    query = Supplier.query
    if not include_archived:
        query = query.filter_by(is_active=True)
    suppliers = []
    for supplier in query.order_by(Supplier.name.asc()).all():
        orders = PurchaseOrder.query.filter_by(supplier_id=supplier.id).all()
        eligible = [
            o for o in orders
            if o.status == "Received" and o.received_date and o.expected_delivery_date
        ]
        on_time = sum(1 for o in eligible if o.received_date <= o.expected_delivery_date)
        pct = round((on_time / len(eligible)) * 100, 1) if eligible else None
        suppliers.append({
            "supplier_id": supplier.id,
            "supplier_name": supplier.name,
            "is_active": supplier.is_active,
            "on_time_delivery": pct,
            "delivered_orders": len(eligible),
            "on_time_orders": on_time,
            "total_orders": len(orders),
        })
    return jsonify({"data": suppliers})


@analytics_bp.route("/analytics/demand", methods=["GET"])
def demand_analytics():
    product_id = request.args.get("product_id", type=int)
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = DemandRecord.query

    # Only include demand from active products (deleted/archived products excluded)
    active_ids = {
        row[0]
        for row in db.session.execute(
            select(Product.id).where(Product.is_active == True)  # noqa: E712
        ).all()
    }
    query = query.filter(DemandRecord.product_id.in_(active_ids))

    if product_id:
        query = query.filter_by(product_id=product_id)
    if start_date:
        query = query.filter(DemandRecord.demand_date >= start_date)
    if end_date:
        query = query.filter(DemandRecord.demand_date <= end_date)

    records = query.order_by(DemandRecord.demand_date.asc()).all()
    if not records:
        return jsonify({
            "data": {
                "chart": [],
                "total_demand": 0,
                "product_id": product_id,
                "start_date": start_date,
                "end_date": end_date,
            }
        })

    totals: dict = {}
    for record in records:
        key = record.demand_date.isoformat()
        totals[key] = totals.get(key, 0) + record.quantity

    chart = [{"date": d, "quantity": q} for d, q in sorted(totals.items())]
    return jsonify({
        "data": {
            "chart": chart,
            "total_demand": sum(totals.values()),
            "product_id": product_id,
            "start_date": start_date,
            "end_date": end_date,
        }
    })
