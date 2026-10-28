import csv
from io import StringIO
from datetime import date, datetime

from flask import Blueprint, Response, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models import DemandRecord, Product
from app.utils.errors import json_error
from app.utils.validators import is_positive_int


def _parse_demand_date(value):
    if value is None or value == "":
        return datetime.utcnow().date()
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise ValueError("Demand date must be a valid ISO date (YYYY-MM-DD)")


demand_bp = Blueprint("demand", __name__)


@demand_bp.route("/demand", methods=["GET"])
def list_demand():
    product_id = request.args.get("product_id", type=int)
    query = DemandRecord.query
    if product_id:
        query = query.filter_by(product_id=product_id)
    records = query.order_by(DemandRecord.demand_date.asc()).all()
    return jsonify({"data": [record.to_dict() for record in records]})


@demand_bp.route("/demand", methods=["POST"])
def create_demand():
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    quantity = data.get("quantity")
    if product_id in (None, ""):
        return json_error("product_id is required", 400)
    if quantity is None:
        return json_error("quantity is required", 400)

    product = db.session.get(Product, product_id)
    if not product:
        return json_error("Product not found", 404)

    try:
        quantity = is_positive_int(quantity, "Quantity")
        demand_date = _parse_demand_date(data.get("demand_date"))
    except (TypeError, ValueError) as exc:
        return json_error(str(exc), 400)

    record = DemandRecord(
        product_id=product.id,
        demand_date=demand_date,
        quantity=quantity,
    )
    try:
        db.session.add(record)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to create demand record", 500)
    return jsonify({"data": record.to_dict()}), 201


@demand_bp.route("/demand/import", methods=["POST"])
def import_demand():
    upload = request.files.get("file")
    if not upload or not upload.filename.lower().endswith(".csv"):
        return json_error("A CSV file is required", 400)
    try:
        content = upload.read().decode("utf-8-sig")
        rows = list(csv.DictReader(content.splitlines()))
    except (UnicodeDecodeError, csv.Error):
        return json_error("Unable to read CSV file as UTF-8", 400)
    if not rows:
        return json_error("CSV file contains no data rows", 400)

    required_columns = {"demand_date", "quantity"}
    columns = set(rows[0].keys() or ())
    if not required_columns.issubset(columns) or not ({"product_id", "sku"} & columns):
        return json_error("CSV must include demand_date, quantity, and product_id or sku columns", 400)

    records = []
    try:
        for row_number, row in enumerate(rows, start=2):
            product = None
            if row.get("product_id"):
                product = db.session.get(Product, int(row["product_id"]))
            elif row.get("sku"):
                product = Product.query.filter_by(sku=row["sku"].strip()).first()
            if not product:
                raise ValueError(f"Row {row_number}: product was not found")
            quantity = is_positive_int(row.get("quantity"), f"Row {row_number} quantity")
            demand_date = _parse_demand_date(row.get("demand_date"))
            records.append(DemandRecord(product_id=product.id, demand_date=demand_date, quantity=quantity))
    except (TypeError, ValueError) as exc:
        db.session.rollback()
        return json_error(str(exc), 400)

    try:
        db.session.add_all(records)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to import demand records", 500)
    return jsonify({"data": {"imported": len(records)}}), 201


@demand_bp.route("/demand/<int:id>", methods=["PUT"])
def update_demand(id):
    record = db.session.get(DemandRecord, id)
    if not record:
        return json_error("Demand record not found", 404)

    data = request.get_json(silent=True) or {}
    if "product_id" in data and data.get("product_id") is not None:
        product = db.session.get(Product, data.get("product_id"))
        if not product:
            return json_error("Product not found", 404)
        record.product_id = product.id
    if "quantity" in data and data.get("quantity") is not None:
        try:
            quantity = is_positive_int(data["quantity"], "Quantity")
        except (TypeError, ValueError) as exc:
            return json_error(str(exc), 400)
        record.quantity = quantity
    if "demand_date" in data:
        try:
            record.demand_date = _parse_demand_date(data.get("demand_date"))
        except ValueError as exc:
            return json_error(str(exc), 400)

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to update demand record", 500)
    return jsonify({"data": record.to_dict()})


@demand_bp.route("/demand/<int:id>", methods=["DELETE"])
def delete_demand(id):
    record = db.session.get(DemandRecord, id)
    if not record:
        return json_error("Demand record not found", 404)
    db.session.delete(record)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to delete demand record", 500)
    return jsonify({"message": "Demand record deleted"})


@demand_bp.route("/demand/export", methods=["GET"])
def export_demand():
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["product_id", "demand_date", "quantity"])
    query = DemandRecord.query.order_by(DemandRecord.demand_date.asc())
    if request.args.get("product_id", type=int):
        query = query.filter_by(product_id=request.args.get("product_id", type=int))
    for record in query.all():
        writer.writerow([record.product_id, record.demand_date.isoformat(), record.quantity])
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=demand_records.csv"})
