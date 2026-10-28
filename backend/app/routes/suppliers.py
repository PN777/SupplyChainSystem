import csv
from io import StringIO

from flask import Blueprint, Response, jsonify, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db
from app.models import PurchaseOrder, Supplier
from app.services.supplier_service import get_supplier_metrics
from app.utils.errors import json_error
from app.utils.validators import required_text

suppliers_bp = Blueprint("suppliers", __name__)


@suppliers_bp.route("/suppliers", methods=["GET"])
def list_suppliers():
    query = Supplier.query.order_by(Supplier.name.asc())
    status_filter = request.args.get("status")  # active, archived, all
    include_archived = request.args.get("include_archived", "").lower() in ("true", "1")
    
    if status_filter == "archived":
        query = query.filter(Supplier.is_active == False)
    elif status_filter == "all" or include_archived:
        pass  # all suppliers
    else:
        query = query.filter(Supplier.is_active == True)

    if request.args.get("search"):
        term = request.args.get("search")
        query = query.filter(Supplier.name.ilike(f"%{term}%"))
    suppliers = [supplier.to_dict() for supplier in query.all()]
    return jsonify({"data": suppliers})


@suppliers_bp.route("/suppliers/<int:id>", methods=["GET"])
def get_supplier(id):
    supplier = db.session.get(Supplier, id)
    if not supplier:
        return json_error("Supplier not found", 404)
    metrics = get_supplier_metrics(id)
    orders = [{
        "id": order.id,
        "status": order.status,
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "expected_delivery_date": order.expected_delivery_date.isoformat() if order.expected_delivery_date else None,
        "received_date": order.received_date.isoformat() if order.received_date else None,
    } for order in PurchaseOrder.query.filter_by(supplier_id=id).all()]
    payload = supplier.to_dict()
    payload["orders"] = orders
    payload["delivery_metrics"] = metrics
    return jsonify({"data": payload})


@suppliers_bp.route("/suppliers", methods=["POST"])
def create_supplier():
    data = request.get_json(silent=True) or {}
    try:
        name = required_text(data.get("name"), "Supplier name", 120)
    except ValueError as exc:
        return json_error(str(exc), 400)
    if Supplier.query.filter(Supplier.name.ilike(name)).first():
        return json_error("Supplier name already exists", 400)
    supplier = Supplier(
        name=name,
        email=data.get("email"),
        phone=data.get("phone"),
        address=data.get("address"),
        is_active=bool(data.get("is_active", True)),
    )
    try:
        db.session.add(supplier)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to create supplier", 500)
    return jsonify({"data": supplier.to_dict()}), 201


@suppliers_bp.route("/suppliers/<int:id>", methods=["PUT"])
def update_supplier(id):
    supplier = db.session.get(Supplier, id)
    if not supplier:
        return json_error("Supplier not found", 404)
    data = request.get_json(silent=True) or {}
    for field in ["name", "email", "phone", "address"]:
        if field in data:
            if field == "name":
                try:
                    setattr(supplier, field, required_text(data[field], "Supplier name", 120))
                except ValueError as exc:
                    return json_error(str(exc), 400)
                existing = Supplier.query.filter(Supplier.name.ilike(supplier.name)).first()
                if existing and existing.id != supplier.id:
                    return json_error("Supplier name already exists", 400)
            else:
                setattr(supplier, field, data[field])
    if "is_active" in data:
        supplier.is_active = bool(data["is_active"])
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to update supplier", 500)
    return jsonify({"data": supplier.to_dict()})


@suppliers_bp.route("/suppliers/<int:id>/archive", methods=["POST"])
def archive_supplier(id):
    supplier = db.session.get(Supplier, id)
    if not supplier:
        return json_error("Supplier not found", 404)
    supplier.is_active = False
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to archive supplier", 500)
    return jsonify({"data": supplier.to_dict(), "message": "Supplier archived successfully."})


@suppliers_bp.route("/suppliers/<int:id>/reactivate", methods=["POST"])
def reactivate_supplier(id):
    supplier = db.session.get(Supplier, id)
    if not supplier:
        return json_error("Supplier not found", 404)
    supplier.is_active = True
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to reactivate supplier", 500)
    return jsonify({"data": supplier.to_dict(), "message": "Supplier reactivated successfully."})


@suppliers_bp.route("/suppliers/<int:id>", methods=["DELETE"])
def delete_supplier(id):
    supplier = db.session.get(Supplier, id)
    if not supplier:
        return json_error("Supplier not found", 404)
    if supplier.products or supplier.purchase_orders:
        return json_error(
            "Supplier has referenced products or purchase orders and cannot be permanently deleted. "
            "Archive this supplier instead to preserve procurement history.",
            400
        )
    db.session.delete(supplier)
    try:
        db.session.commit()
    except (IntegrityError, SQLAlchemyError):
        db.session.rollback()
        return json_error("Unable to delete supplier", 500)
    return jsonify({"message": "Supplier deleted"})


@suppliers_bp.route("/suppliers/import", methods=["POST"])
def import_suppliers():
    upload = request.files.get("file")
    if not upload or not upload.filename.lower().endswith(".csv"):
        return json_error("A CSV file is required", 400)
    try:
        rows = list(csv.DictReader(upload.read().decode("utf-8-sig").splitlines()))
    except (UnicodeDecodeError, csv.Error):
        return json_error("Unable to read CSV file as UTF-8", 400)
    if not rows or "name" not in (rows[0].keys() or ()):
        return json_error("CSV must include a name column", 400)
    suppliers = []
    existing_names = {supplier.name.casefold() for supplier in Supplier.query.all()}
    seen_names = set()
    for row_number, row in enumerate(rows, start=2):
        try:
            name = required_text(row.get("name"), f"Row {row_number} supplier name", 120)
        except ValueError as exc:
            db.session.rollback()
            return json_error(str(exc), 400)
        if name.casefold() in existing_names or name.casefold() in seen_names:
            continue
        seen_names.add(name.casefold())
        suppliers.append(Supplier(name=name, email=row.get("email"), phone=row.get("phone"), address=row.get("address")))
    try:
        db.session.add_all(suppliers)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return json_error("Unable to import suppliers", 500)
    return jsonify({"data": {"imported": len(suppliers), "skipped": len(rows) - len(suppliers), "rejected": 0}}), 201


@suppliers_bp.route("/suppliers/export", methods=["GET"])
def export_suppliers():
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["name", "email", "phone", "address"])
    for supplier in Supplier.query.order_by(Supplier.name.asc()).all():
        writer.writerow([supplier.name, supplier.email or "", supplier.phone or "", supplier.address or ""])
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=suppliers.csv"})
