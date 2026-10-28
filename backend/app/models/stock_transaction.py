from datetime import datetime

from app.extensions import db


class StockMovement(db.Model):
    __tablename__ = "stock_movements"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    movement_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date())
    movement_type = db.Column(db.String(30), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    reference = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey("purchase_orders.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def delta(self):
        if self.movement_type in ("Stock In", "Return", "Opening Stock"):
            return self.quantity
        if self.movement_type == "Stock Out":
            return -self.quantity
        if self.movement_type == "Adjustment":
            return self.quantity
        return 0

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "product_sku": self.product.sku if self.product else None,
            "movement_date": self.movement_date.isoformat() if self.movement_date else None,
            "movement_type": self.movement_type,
            "quantity": self.quantity,
            "reference": self.reference,
            "description": self.description,
            "purchase_order_id": self.purchase_order_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
