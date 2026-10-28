from datetime import date, timedelta
from io import BytesIO


def create_product(client, sku="SKU-1", name="Test Product", **overrides):
    payload = {
        "sku": sku,
        "name": name,
        "category": "General",
        "unit_cost": 10,
        "lead_time_days": 5,
        "safety_stock": 2,
        "max_stock": 100,
    }
    payload.update(overrides)
    response = client.post("/api/products", json=payload)
    assert response.status_code == 201, response.get_json()
    return response.get_json()["data"]


def create_supplier(client, name="Test Supplier"):
    response = client.post("/api/suppliers", json={"name": name})
    assert response.status_code == 201, response.get_json()
    return response.get_json()["data"]


def test_product_filters_and_validation(client):
    create_product(client, sku="LOW", name="Low", safety_stock=10)
    assert client.get("/api/products?stock_status=low").status_code == 200
    assert client.get("/api/products?stock_status=out").status_code == 200
    assert client.get("/api/products?stock_status=excess").status_code == 200
    assert client.get("/api/products?stock_status=unknown").status_code == 400

    assert client.post("/api/products", json={"sku": "BAD", "name": "Bad", "unit_cost": -1}).status_code == 400
    assert client.post("/api/products", json={"sku": "BAD3", "name": "Bad", "lead_time_days": 2.5}).status_code == 400
    assert client.post("/api/products", json={"sku": "BAD4", "name": "Bad", "safety_stock": -1}).status_code == 400
    assert client.post("/api/products", json={"sku": "BAD5", "name": "Bad", "unit_cost": float("inf")}).status_code == 400
    assert client.post("/api/products", json={"sku": "BAD2", "name": "Bad", "supplier_id": 999}).status_code == 404


def test_inventory_adjustment_is_persisted_and_referenced_product_is_protected(client):
    product = create_product(client, sku="INVENTORY-1")
    assert client.post("/api/stock/movements", json={
        "product_id": product["id"], "movement_type": "Stock In", "quantity": 23, "reference": "opening",
    }).status_code == 201
    assert client.get("/api/stock/summary").get_json()["products"][0]["stock"] == 23
    assert client.post("/api/stock/movements", json={
        "product_id": product["id"], "movement_type": "Stock Out", "quantity": 3, "reference": "inventory-adjustment",
    }).status_code == 201
    assert client.get("/api/stock/summary").get_json()["products"][0]["stock"] == 20
    assert client.delete(f"/api/products/{product['id']}").status_code == 400


def test_stock_movement_rollback_and_inventory_valuation(client):
    product = create_product(client, unit_cost=12.5)
    response = client.post("/api/stock/movements", json={
        "product_id": product["id"],
        "movement_type": "Stock In",
        "quantity": 8,
        "reference": "opening",
    })
    assert response.status_code == 201
    assert client.post("/api/stock/movements", json={
        "product_id": product["id"],
        "movement_type": "Stock Out",
        "quantity": 9,
    }).status_code == 400
    summary = client.get("/api/stock/summary").get_json()["products"]
    assert summary[0]["stock"] == 8
    analytics = client.get("/api/analytics/dashboard").get_json()["data"]
    assert analytics["total_inventory_value"] == 100


def test_inventory_summary_search_matches_name_and_sku(client):
    create_product(client, sku="SENSOR-42", name="Blue Sensor")
    create_product(client, sku="ROUTER-9", name="Blue Router")
    assert len(client.get("/api/stock/summary?search=sensor").get_json()["products"]) == 1
    assert len(client.get("/api/stock/summary?search=%20ROUTER-9%20").get_json()["products"]) == 1
    assert client.get("/api/stock/summary?search=missing").get_json()["products"] == []


def test_analytics_aggregates_demand_and_receipt_is_read_only(client):
    product = create_product(client, sku="ANALYTICS-1", unit_cost=12.5)
    movement = client.post("/api/stock/movements", json={
        "product_id": product["id"],
        "movement_type": "Stock In",
        "quantity": 8,
        "reference": "receipt-1",
        "description": "Opening stock",
    })
    movement_id = movement.get_json()["data"]["id"]
    for quantity in (3, 4):
        assert client.post("/api/demand", json={
            "product_id": product["id"],
            "demand_date": date.today().isoformat(),
            "quantity": quantity,
        }).status_code == 201

    demand = client.get(f"/api/analytics/demand?product_id={product['id']}").get_json()["data"]
    assert demand["chart"] == [{"date": date.today().isoformat(), "quantity": 7}]
    assert demand["total_demand"] == 7
    inventory = client.get("/api/analytics/inventory").get_json()["data"]["chart"]
    assert inventory[0]["stock_value"] == 100

    before = client.get("/api/stock/summary").get_json()["products"][0]["stock"]
    receipt_response = client.get(f"/api/stock/movements/{movement_id}/receipt")
    assert receipt_response.status_code == 200
    receipt = receipt_response.get_json()["data"]
    assert receipt["product_sku"] == "ANALYTICS-1"
    assert receipt["stock_before"] == 0
    assert receipt["stock_after"] == 8
    assert client.get("/api/stock/summary").get_json()["products"][0]["stock"] == before
    assert client.get("/api/stock/movements/9999/receipt").status_code == 404


def test_demand_forecast_uses_persisted_records(client):
    product = create_product(client)
    for index, quantity in enumerate((4, 6, 8), start=1):
        response = client.post("/api/demand", json={
            "product_id": product["id"],
            "demand_date": (date.today() - timedelta(days=3 - index)).isoformat(),
            "quantity": quantity,
        })
        assert response.status_code == 201
    forecast = client.get(f"/api/forecast?product_id={product['id']}&horizon=2")
    assert forecast.status_code == 200
    assert forecast.get_json()["data"]["forecast"] == [6.0, 6.0]
    evaluation = client.get(f"/api/forecast/evaluation?product_id={product['id']}")
    assert evaluation.status_code == 200
    assert evaluation.get_json()["data"]["metric_name"] == "mae"


def test_demand_crud_and_zero_filled_forecast_period(client):
    product = create_product(client, sku="DEMAND-CRUD")
    first_date = date.today() - timedelta(days=4)
    for demand_date, quantity in ((first_date, 4), (first_date, 6), (date.today(), 8)):
        response = client.post("/api/demand", json={
            "product_id": product["id"],
            "demand_date": demand_date.isoformat(),
            "quantity": quantity,
        })
        assert response.status_code == 201
    records = client.get(f"/api/demand?product_id={product['id']}").get_json()["data"]
    assert len(records) == 3
    record_id = records[0]["id"]
    assert client.put(f"/api/demand/{record_id}", json={"quantity": 9}).status_code == 200
    assert client.get(f"/api/demand/{record_id}").status_code == 405
    forecast = client.get(f"/api/forecast?product_id={product['id']}&horizon=2").get_json()["data"]
    assert forecast["observations"] == 5
    assert forecast["period_start"] == first_date.isoformat()
    assert forecast["period_end"] == date.today().isoformat()
    assert forecast["forecast"] == [4.6, 4.6]
    assert client.delete(f"/api/demand/{record_id}").status_code == 200
    assert len(client.get(f"/api/demand?product_id={product['id']}").get_json()["data"]) == 2
    assert client.post("/api/demand", json={"product_id": product["id"], "demand_date": date.today().isoformat(), "quantity": 0}).status_code == 400


def test_forecast_insufficient_data_is_explicit(client):
    product = create_product(client, sku="DEMAND-SMALL")
    assert client.post("/api/demand", json={
        "product_id": product["id"],
        "demand_date": date.today().isoformat(),
        "quantity": 3,
    }).status_code == 201
    forecast = client.get(f"/api/forecast?product_id={product['id']}").get_json()["data"]
    assert forecast["forecast"] == []
    assert "Insufficient" in forecast["explanation"]


def test_purchase_order_receive_is_atomic_and_idempotent(client):
    supplier = create_supplier(client)
    product = create_product(client, supplier_id=supplier["id"])
    order = client.post("/api/purchase-orders", json={
        "supplier_id": supplier["id"],
        "items": [{"product_id": product["id"], "quantity": 5}],
    })
    assert order.status_code == 201
    order_id = order.get_json()["data"]["id"]
    assert client.get("/api/stock/summary").get_json()["products"][0]["stock"] == 0

    received = client.post(f"/api/purchase-orders/{order_id}/receive")
    assert received.status_code == 200
    assert client.get("/api/stock/summary").get_json()["products"][0]["stock"] == 5
    assert client.post(f"/api/purchase-orders/{order_id}/receive").status_code == 400
    movements = client.get("/api/stock/movements").get_json()["data"]
    assert len([item for item in movements if item["purchase_order_id"] == order_id]) == 1


def test_invalid_purchase_order_does_not_leave_partial_order(client):
    supplier = create_supplier(client)
    response = client.post("/api/purchase-orders", json={
        "supplier_id": supplier["id"],
        "items": [{"product_id": 999, "quantity": 2}],
    })
    assert response.status_code == 404
    assert client.get("/api/purchase-orders").get_json()["data"] == []


def test_missing_records_and_settings_validation(client):
    assert client.get("/api/products/999").status_code == 404
    assert client.get("/api/demand/999").status_code == 405
    assert client.post("/api/settings", json={"theme": None}).status_code == 400


def test_supplier_crud_and_analytics_endpoints(client):
    supplier = create_supplier(client, "Supplier One")
    assert client.get(f"/api/suppliers/{supplier['id']}").status_code == 200
    updated = client.put(f"/api/suppliers/{supplier['id']}", json={"name": "Supplier Updated"})
    assert updated.status_code == 200
    assert updated.get_json()["data"]["name"] == "Supplier Updated"
    assert client.get("/api/analytics/inventory").get_json()["data"]["chart"] == []
    assert client.get("/api/analytics/demand").get_json()["data"]["chart"] == []
    assert client.delete(f"/api/suppliers/{supplier['id']}").status_code == 200


def test_supplier_duplicates_and_csv_exports(client):
    create_supplier(client, "Unique Supplier")
    assert client.post("/api/suppliers", json={"name": "unique supplier"}).status_code == 400
    product = create_product(client, sku="EXPORT-1")
    demand = client.post("/api/demand", json={
        "product_id": product["id"],
        "demand_date": date.today().isoformat(),
        "quantity": 6,
    })
    assert demand.status_code == 201
    assert "EXPORT-1" in client.get("/api/products/export").get_data(as_text=True)
    assert "Unique Supplier" in client.get("/api/suppliers/export").get_data(as_text=True)
    assert f"{product['id']}," in client.get("/api/demand/export").get_data(as_text=True)
    filtered = client.get(f"/api/analytics/demand?product_id={product['id']}&start_date={date.today().isoformat()}&end_date={date.today().isoformat()}")
    assert filtered.get_json()["data"]["total_demand"] == 6


def test_product_import_is_atomic_and_skips_existing_skus(client):
    create_product(client, sku="IMPORTED-1")
    csv_data = b"sku,name,category,unit_cost,lead_time_days,reorder_point,max_stock\nIMPORTED-1,Existing,General,10,5,2,10\nIMPORTED-2,Imported,General,12,6,3,20\n"
    response = client.post("/api/products/import", data={"file": (BytesIO(csv_data), "products.csv")}, content_type="multipart/form-data")
    assert response.status_code == 201
    assert response.get_json()["data"] == {"imported": 1, "skipped": 1, "rejected": 0}
    assert client.get("/api/products?search=IMPORTED-2").get_json()["data"]["total"] == 1


def test_product_update_rejects_invalid_numbers_with_400(client):
    product = create_product(client, sku="UPDATE-VALIDATION")
    for invalid_payload in (
        {"lead_time_days": "abc"},
        {"lead_time_days": -1},
        {"safety_stock": -5},
        {"max_stock": "abc"},
        {"unit_cost": "abc"},
    ):
        response = client.put(f"/api/products/{product['id']}", json=invalid_payload)
        assert response.status_code == 400, (invalid_payload, response.status_code)
        assert "error" in response.get_json()
    updated = client.put(f"/api/products/{product['id']}", json={"lead_time_days": 4, "safety_stock": 3, "max_stock": 55})
    assert updated.status_code == 200
    data = updated.get_json()["data"]
    assert data["lead_time_days"] == 4
    assert data["safety_stock"] == 3
    assert data["max_stock"] == 55


def test_purchase_order_item_unit_cost_validation_returns_400(client):
    supplier = create_supplier(client)
    product = create_product(client, sku="PO-COST")
    invalid_create = client.post("/api/purchase-orders", json={
        "supplier_id": supplier["id"],
        "items": [{"product_id": product["id"], "quantity": 5, "unit_cost": "abc"}],
    })
    assert invalid_create.status_code == 400
    assert "error" in invalid_create.get_json()
    assert client.get("/api/purchase-orders").get_json()["data"] == []

    order = client.post("/api/purchase-orders", json={
        "supplier_id": supplier["id"],
        "items": [{"product_id": product["id"], "quantity": 5, "unit_cost": 4}],
    })
    assert order.status_code == 201
    order_id = order.get_json()["data"]["id"]
    invalid_update = client.put(f"/api/purchase-orders/{order_id}", json={
        "items": [{"product_id": product["id"], "quantity": 5, "unit_cost": "abc"}],
    })
    assert invalid_update.status_code == 400
    assert "error" in invalid_update.get_json()
    assert client.get(f"/api/purchase-orders/{order_id}").get_json()["data"]["items"][0]["unit_cost"] == 4


def test_demand_csv_import_is_atomic(client):
    product = create_product(client, sku="CSV-1")
    response = client.post("/api/demand/import", data={
        "file": (BytesIO(
            f"sku,demand_date,quantity\nCSV-1,{date.today().isoformat()},4\n".encode()
        ), "demand.csv"),
    }, content_type="multipart/form-data")
    assert response.status_code == 201
    assert response.get_json()["data"]["imported"] == 1
    assert len(client.get(f"/api/demand?product_id={product['id']}").get_json()["data"]) == 1

    invalid = client.post("/api/demand/import", data={
        "file": (BytesIO(
            f"sku,demand_date,quantity\nCSV-1,{date.today().isoformat()},5\nMISSING,{date.today().isoformat()},2\n".encode()
        ), "bad.csv"),
    }, content_type="multipart/form-data")
    assert invalid.status_code == 400
    assert len(client.get(f"/api/demand?product_id={product['id']}").get_json()["data"]) == 1
