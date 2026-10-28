from datetime import datetime

from app.extensions import db


class DemandRecord(db.Model):
    __tablename__ = "demand_records"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    demand_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date())
    quantity = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "demand_date": self.demand_date.isoformat() if self.demand_date else None,
            "quantity": self.quantity,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
