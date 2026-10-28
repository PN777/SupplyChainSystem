import os
from datetime import date, timedelta
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS

from .config import Config
from .extensions import db


def seed_demo_data():
    from .models import DemandRecord, Product, PurchaseOrder, PurchaseOrderItem, Setting, StockMovement, Supplier

    if Supplier.query.first() or Product.query.first():
        return

    suppliers = [
        Supplier(name="Northwind Components", email="orders@northwindcomponents.com", phone="555-0101", address="Seattle, WA"),
        Supplier(name="BluePeak Logistics", email="ops@bluepeaklogistics.com", phone="555-0102", address="Austin, TX"),
        Supplier(name="Harborline Supply Co.", email="service@harborlinesupply.com", phone="555-0103", address="Houston, TX"),
    ]
    db.session.add_all(suppliers)
    db.session.flush()

    products = [
        Product(sku="SC-1001", name="Alpha Sensor Node", category="Electronics", unit_cost=68.0, lead_time_days=7, safety_stock=15, max_stock=180, supplier_id=suppliers[0].id),
        Product(sku="SC-1002", name="Vector Router", category="Connectivity", unit_cost=126.0, lead_time_days=9, safety_stock=18, max_stock=220, supplier_id=suppliers[0].id),
        Product(sku="SC-1003", name="Harbor Dock Kit", category="Accessories", unit_cost=42.0, lead_time_days=5, safety_stock=20, max_stock=200, supplier_id=suppliers[1].id),
        Product(sku="SC-1004", name="Delta Monitor", category="Displays", unit_cost=210.0, lead_time_days=10, safety_stock=12, max_stock=140, supplier_id=suppliers[1].id),
        Product(sku="SC-1005", name="Summit Battery Pack", category="Power", unit_cost=32.0, lead_time_days=8, safety_stock=10, max_stock=150, supplier_id=suppliers[2].id),
    ]
    db.session.add_all(products)
    db.session.flush()

    base_day = date.today()
    for product in products:
        for offset in range(18):
            demand_date = base_day - timedelta(days=17 - offset)
            quantity = 4 + ((product.id * 2 + offset) % 6)
            db.session.add(DemandRecord(product_id=product.id, demand_date=demand_date, quantity=quantity))

    for product in products:
        db.session.add(StockMovement(product_id=product.id, movement_date=base_day - timedelta(days=10), movement_type="Stock In", quantity=25, reference="opening", description="Initial stock"))
        db.session.add(StockMovement(product_id=product.id, movement_date=base_day - timedelta(days=4), movement_type="Stock Out", quantity=8, reference="sale", description="Shipment dispatch"))

    supplier_order = PurchaseOrder(supplier_id=suppliers[0].id, order_date=base_day - timedelta(days=20), expected_delivery_date=base_day - timedelta(days=10), received_date=base_day - timedelta(days=12), status="Received")
    db.session.add(supplier_order)
    db.session.flush()
    db.session.add(PurchaseOrderItem(purchase_order_id=supplier_order.id, product_id=products[0].id, quantity=18, unit_cost=products[0].unit_cost))
    db.session.add(PurchaseOrderItem(purchase_order_id=supplier_order.id, product_id=products[1].id, quantity=12, unit_cost=products[1].unit_cost))
    db.session.add(StockMovement(product_id=products[0].id, movement_date=base_day - timedelta(days=12), movement_type="Stock In", quantity=18, reference="PO-101", description="Received from supplier", purchase_order_id=supplier_order.id))

    pending_order = PurchaseOrder(supplier_id=suppliers[2].id, order_date=base_day - timedelta(days=7), expected_delivery_date=base_day + timedelta(days=3), received_date=None, status="Pending")
    db.session.add(pending_order)
    db.session.flush()
    db.session.add(PurchaseOrderItem(purchase_order_id=pending_order.id, product_id=products[4].id, quantity=16, unit_cost=products[4].unit_cost))

    db.session.add(Setting(key="default_forecast_horizon", value="7"))
    db.session.add(Setting(key="demand_lookback_days", value="30"))
    db.session.add(Setting(key="theme", value="dark"))
    db.session.commit()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    if os.getenv("FLASK_ENV") == "testing":
        app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///:memory:")

    from .routes import register_routes

    db.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*").split(",")}},
        supports_credentials=True,
    )

    with app.app_context():
        from .models import Product, Supplier, PurchaseOrder, PurchaseOrderItem, StockMovement, DemandRecord, Setting
        db.create_all()
        # Operational views must never create fabricated records on startup.
        # Existing records are preserved; demo data can be loaded explicitly by
        # calling the seed helper from a controlled development script.

    register_routes(app)

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(500)
    def server_error(error):
        return jsonify({"error": "Internal server error"}), 500

    return app
