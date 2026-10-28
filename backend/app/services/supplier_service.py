from app.extensions import db
from app.models import PurchaseOrder, Supplier


def get_supplier_metrics(supplier_id):
    supplier = db.session.get(Supplier, supplier_id)
    if not supplier:
        raise ValueError("Supplier not found")
    orders = PurchaseOrder.query.filter_by(supplier_id=supplier_id).all()
    if not orders:
        return {"on_time_delivery": "Insufficient data", "orders": 0}
    delivered = [order for order in orders if order.received_date and order.expected_delivery_date]
    on_time = 0
    for order in delivered:
        if order.received_date <= order.expected_delivery_date:
            on_time += 1
    pct = round((on_time / len(delivered)) * 100, 2) if delivered else None
    return {
        "on_time_delivery": pct if pct is not None else "Insufficient data",
        "orders": len(orders),
        "on_time_count": on_time,
        "delivered_count": len(delivered),
    }
