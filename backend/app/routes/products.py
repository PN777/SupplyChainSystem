import csv
from io import StringIO

from flask import Blueprint, Response, jsonify, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db
from app.models import Product, Supplier
from app.utils.errors import json_error
from app.utils.validators import is_non_negative_int, is_non_negative_number, required_text

products_bp = Blueprint("products", __name__)


@products_bp.route("/products", methods=["GET"])
def list_products():
    search = request.args.get("search", "")
    category = request.args.get("category")
    stock_status = request.args.get("stock_status")
    status_filter = request.args.get("status")  # active, archived, all
    include_archived = request.args.get("include_archived", "").lower() in ("true", "1")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)

    query = Product.query
    if page < 1 or per_page < 1 or per_page > 100:
        return json_error("page must be positive and per_page must be between 1 and 100", 400)
    
    # Active / archived filter
    if status_filter == "archived":
        query = query.filter(Product.is_active == False)
    elif status_filter == "all" or include_archived:
        pass  # include both
    else:
        # Default: only active products
        query = query.filter(Product.is_active == True)

    if search:
        query = query.filter((Product.sku.ilike(f"%{search}%")) | (Product.name.ilike(f"%{search}%")))
    if category:
        query = query.filter(Product.category == category)
    if stock_status not in (None, "", "low", "out", "excess"):
        return json_error("Unsupported stock_status", 400)

    products = query.order_by(Product.name.asc()).all()
    filtered_products = []
    for product in products:
        stock = product.current_stock
        if stock_status == "low" and stock > product.reorder_point:
            continue
        if stock_status == "out" and stock > 0:
            continue
        if stock_status == "excess" and stock <= product.max_stock:
            continue
        filtered_products.append(product)
    total = len(filtered_products)
    start = (page - 1) * per_page
    items = [product.to_dict() for product in filtered_products[start:start + per_page]]
    pages = (total + per_page - 1) // per_page if total else 0
    return jsonify({"data": {"items": items, "page": page, "per_page": per_page, "total": total, "pages": pages}})


@products_bp.route("/products/<int:id>", methods=["GET"])
def get_product(id):
    product = db.session.get(Product, id)
    if not product:
        return json_error("Product not found", 404)
    return jsonify({"data": product.to_dict()})


@products_bp.route("/products", methods=["POST"])
def create_product():
    data = request.get_json(silent=True) or {}
    try:
        sku = required_text(data.get("sku"), "SKU", 80)
        name = required_text(data.get("name"), "Name", 200)
    except ValueError as exc:
        return json_error(str(exc), 400)
    if Product.query.filter_by(sku=sku).first():
        return json_error("Product SKU already exists", 400)

    supplier_id = data.get("supplier_id")
    if supplier_id in ("", None):
        supplier_id = None
    else:
        try:
            supplier_id = int(supplier_id)
        except (ValueError, TypeError):
            return json_error("Invalid supplier_id", 400)
        if not db.session.get(Supplier, supplier_id):
            return json_error("Supplier not found", 404)

    try:
        product = Product(
            sku=sku,
            name=name,
            category=required_text(data.get("category", "General"), "Category", 80),
            unit_cost=is_non_negative_number(data.get("unit_cost", 0), "unit_cost"),
            lead_time_days=is_non_negative_int(data.get("lead_time_days", 7), "lead_time_days"),
            safety_stock=is_non_negative_int(data.get("safety_stock", 0), "safety_stock"),
            max_stock=is_non_negative_int(data.get("max_stock", 0), "max_stock"),
            supplier_id=supplier_id,
            is_active=bool(data.get("is_active", True)),
        )
    except (TypeError, ValueError) as exc:
        return json_error(str(exc), 400)

    try:
        db.session.add(product)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return json_error("Product SKU already exists", 400)
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to create product", 500)
    return jsonify({"data": product.to_dict()}), 201


@products_bp.route("/products/<int:id>", methods=["PUT"])
def update_product(id):
    product = db.session.get(Product, id)
    if not product:
        return json_error("Product not found", 404)
    data = request.get_json(silent=True) or {}

    if "sku" in data and data["sku"] and data["sku"] != product.sku:
        try:
            product.sku = required_text(data["sku"], "SKU", 80)
        except ValueError as exc:
            return json_error(str(exc), 400)
        existing = Product.query.filter_by(sku=product.sku).first()
        if existing and existing.id != product.id:
            return json_error("Product SKU already exists", 400)
    elif "sku" in data and not data["sku"]:
        return json_error("SKU is required", 400)
    if "name" in data:
        try:
            product.name = required_text(data["name"], "Name", 200)
        except ValueError as exc:
            return json_error(str(exc), 400)
    if "category" in data:
        try:
            product.category = required_text(data["category"], "Category", 80)
        except ValueError as exc:
            return json_error(str(exc), 400)
    if "unit_cost" in data:
        try:
            product.unit_cost = is_non_negative_number(data["unit_cost"], "unit_cost")
        except ValueError as exc:
            return json_error(str(exc), 400)
    try:
        if "lead_time_days" in data:
            product.lead_time_days = is_non_negative_int(data["lead_time_days"], "lead_time_days")
        if "safety_stock" in data:
            product.safety_stock = is_non_negative_int(data["safety_stock"], "safety_stock")
        if "max_stock" in data:
            product.max_stock = is_non_negative_int(data["max_stock"], "max_stock")
    except (TypeError, ValueError) as exc:
        return json_error(str(exc), 400)
    if "supplier_id" in data:
        sup_id = data["supplier_id"]
        if sup_id in (None, ""):
            product.supplier_id = None
        else:
            try:
                sup_id = int(sup_id)
            except (ValueError, TypeError):
                return json_error("Invalid supplier_id", 400)
            if not db.session.get(Supplier, sup_id):
                return json_error("Supplier not found", 404)
            product.supplier_id = sup_id
    if "is_active" in data:
        product.is_active = bool(data["is_active"])

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return json_error("Product SKU already exists", 400)
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to update product", 500)
    return jsonify({"data": product.to_dict()})


@products_bp.route("/products/<int:id>/archive", methods=["POST"])
def archive_product(id):
    product = db.session.get(Product, id)
    if not product:
        return json_error("Product not found", 404)
    product.is_active = False
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to archive product", 500)
    return jsonify({"data": product.to_dict(), "message": "Product archived successfully."})


@products_bp.route("/products/<int:id>/reactivate", methods=["POST"])
def reactivate_product(id):
    product = db.session.get(Product, id)
    if not product:
        return json_error("Product not found", 404)
    product.is_active = True
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to reactivate product", 500)
    return jsonify({"data": product.to_dict(), "message": "Product reactivated successfully."})


@products_bp.route("/products/<int:id>", methods=["DELETE"])
def delete_product(id):
    product = db.session.get(Product, id)
    if not product:
        return json_error("Product not found", 404)
    if product.stock_movements or product.demand_records or product.purchase_order_items:
        return json_error(
            "Product has historical inventory, demand, or purchase-order records and cannot be permanently deleted. "
            "Archive this product instead to preserve audit history.",
            400
        )
    db.session.delete(product)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to delete product", 500)
    return jsonify({"message": "Product deleted"})


@products_bp.route("/products/import", methods=["POST"])
def import_products():
    upload = request.files.get("file")
    if not upload or not upload.filename.lower().endswith(".csv"):
        return json_error("A CSV file is required", 400)
    try:
        rows = list(csv.DictReader(upload.read().decode("utf-8-sig").splitlines()))
    except (UnicodeDecodeError, csv.Error):
        return json_error("Unable to read CSV file as UTF-8", 400)
    required = {"sku", "name", "unit_cost", "lead_time_days", "reorder_point"}
    if not rows or not required.issubset(set(rows[0].keys() or ())):
        return json_error("CSV must include sku, name, unit_cost, lead_time_days, and reorder_point columns", 400)

    products = []
    seen_skus = set()
    try:
        for row_number, row in enumerate(rows, start=2):
            sku = required_text(row.get("sku"), f"Row {row_number} SKU", 80)
            if sku in seen_skus or Product.query.filter_by(sku=sku).first():
                continue
            seen_skus.add(sku)
            supplier_id = int(row["supplier_id"]) if row.get("supplier_id") else None
            if supplier_id is not None and not db.session.get(Supplier, supplier_id):
                raise ValueError(f"Row {row_number}: supplier was not found")
            products.append(Product(
                sku=sku,
                name=required_text(row.get("name"), f"Row {row_number} name", 200),
                category=required_text(row.get("category") or "General", f"Row {row_number} category", 80),
                unit_cost=is_non_negative_number(row.get("unit_cost"), f"Row {row_number} unit_cost"),
                lead_time_days=is_non_negative_int(row.get("lead_time_days"), f"Row {row_number} lead_time_days"),
                safety_stock=is_non_negative_int(row.get("reorder_point"), f"Row {row_number} reorder_point"),
                max_stock=is_non_negative_int(row.get("max_stock") or 0, f"Row {row_number} max_stock"),
                supplier_id=supplier_id,
            ))
    except (TypeError, ValueError) as exc:
        db.session.rollback()
        return json_error(str(exc), 400)
    try:
        db.session.add_all(products)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to import products", 500)
    return jsonify({"data": {"imported": len(products), "skipped": len(rows) - len(products), "rejected": 0}}), 201


@products_bp.route("/products/export", methods=["GET"])
def export_products():
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["sku", "name", "category", "unit_cost", "lead_time_days", "reorder_point", "max_stock", "supplier_id"])
    for product in Product.query.order_by(Product.name.asc()).all():
        writer.writerow([product.sku, product.name, product.category, product.unit_cost, product.lead_time_days, product.safety_stock, product.max_stock, product.supplier_id or ""])
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=products.csv"})
