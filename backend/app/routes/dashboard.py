from flask import Blueprint, jsonify

from app.models import DemandRecord, Product, PurchaseOrder, StockMovement


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/dashboard", methods=["GET"])
def dashboard_summary():
    products = Product.query.filter_by(is_active=True).all()
    metrics = {
        "total_products": len(products),
        "total_inventory_value": round(sum(p.current_stock * p.unit_cost for p in products), 2),
        "low_stock_products": sum(1 for p in products if p.current_stock <= p.reorder_point),
        "out_of_stock_products": sum(1 for p in products if p.current_stock <= 0),
        "pending_purchase_orders": PurchaseOrder.query.filter(PurchaseOrder.status.in_(["Pending", "Approved", "Shipped"])).count(),
        "average_sales_demand": round(sum(r.quantity for r in DemandRecord.query.all()) / len(DemandRecord.query.all()) if DemandRecord.query.count() else 0, 2),
    }
    return jsonify({"data": metrics})


@dashboard_bp.route("/dashboard/activity", methods=["GET"])
def dashboard_activity():
    movements = StockMovement.query.order_by(StockMovement.created_at.desc()).limit(10).all()
    return jsonify({"data": [m.to_dict() for m in movements]})
