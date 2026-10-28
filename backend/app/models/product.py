from datetime import datetime

from app.extensions import db


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(80), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    unit_cost = db.Column(db.Float, nullable=False, default=0.0)
    lead_time_days = db.Column(db.Integer, nullable=False, default=7)
    safety_stock = db.Column(db.Integer, nullable=False, default=0)
    max_stock = db.Column(db.Integer, nullable=False, default=0)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stock_movements = db.relationship("StockMovement", backref="product", lazy=True)
    demand_records = db.relationship("DemandRecord", backref="product", lazy=True)
    purchase_order_items = db.relationship("PurchaseOrderItem", backref="product", lazy=True)

    @property
    def current_stock(self):
        return sum(movement.delta() for movement in self.stock_movements)

    @property
    def reorder_point(self):
        if not self.demand_records:
            return self.safety_stock
        start = min(record.demand_date for record in self.demand_records)
        end = max(record.demand_date for record in self.demand_records)
        totals = {}
        for record in self.demand_records:
            totals[record.demand_date] = totals.get(record.demand_date, 0) + record.quantity
        calendar_days = (end - start).days + 1
        avg_daily_demand = sum(totals.values()) / max(calendar_days, 1)
        return int((avg_daily_demand * self.lead_time_days) + self.safety_stock)

    def to_dict(self):
        return {
            "id": self.id,
            "sku": self.sku,
            "name": self.name,
            "category": self.category,
            "unit_cost": float(self.unit_cost),
            "lead_time_days": self.lead_time_days,
            "safety_stock": self.safety_stock,
            "max_stock": self.max_stock,
            "supplier_id": self.supplier_id,
            "supplier_name": self.supplier.name if self.supplier else None,
            "is_active": self.is_active if self.is_active is not None else True,
            "current_stock": self.current_stock,
            "reorder_point": self.reorder_point,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
