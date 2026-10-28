from flask import Blueprint

from .analytics import analytics_bp
from .dashboard import dashboard_bp
from .demand import demand_bp
from .forecasting import forecasting_bp
from .inventory import inventory_bp
from .products import products_bp
from .purchase_orders import purchase_orders_bp
from .settings import settings_bp
from .suppliers import suppliers_bp


def register_routes(app):
    app.register_blueprint(products_bp, url_prefix="/api")
    app.register_blueprint(suppliers_bp, url_prefix="/api")
    app.register_blueprint(purchase_orders_bp, url_prefix="/api")
    app.register_blueprint(inventory_bp, url_prefix="/api")
    app.register_blueprint(demand_bp, url_prefix="/api")
    app.register_blueprint(forecasting_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp, url_prefix="/api")

    @app.route("/api/health")
    def health():
        from app.extensions import db
        try:
            db.session.execute(db.text("SELECT 1"))
            db_status = "healthy"
        except Exception as exc:
            db_status = f"unhealthy: {exc}"
        return {
            "status": "ok" if db_status == "healthy" else "degraded",
            "database": db_status,
            "service": "supply-chain-system",
        }
