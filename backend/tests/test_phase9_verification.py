from app.extensions import db
from app.models import Product, Supplier, PurchaseOrder, PurchaseOrderItem, StockMovement, DemandRecord


def test_full_product_lifecycle_and_archiving(client):
    # 1. Create product
    res = client.post("/api/products", json={
        "sku": "TEST-PROD-001",
        "name": "Integration Test Widget",
        "category": "Electronics",
        "unit_cost": 50.0,
        "lead_time_days": 5,
        "safety_stock": 10,
        "max_stock": 100,
    })
    assert res.status_code == 201
    prod_id = res.get_json()["data"]["id"]

    # Verify present in products (paginated) and stock summary
    res = client.get("/api/products")
    assert any(p["id"] == prod_id for p in res.get_json()["data"]["items"])

    res = client.get("/api/stock/summary")
    assert any(p["id"] == prod_id for p in res.get_json()["products"])

    # 2. Add Opening Stock via /api/stock/movements
    res = client.post("/api/stock/movements", json={
        "product_id": prod_id,
        "movement_type": "Opening Stock",
        "quantity": 25,
        "movement_date": "2026-10-20",
        "reference": "opening-stock",
        "description": "Initial warehouse inventory",
    })
    assert res.status_code == 201

    res = client.get(f"/api/products/{prod_id}")
    assert res.get_json()["data"]["current_stock"] == 25

    # Verify movement record type is 'Opening Stock'
    res = client.get("/api/stock/movements")
    movements = [m for m in res.get_json()["data"] if m["product_id"] == prod_id]
    assert len(movements) == 1
    assert movements[0]["movement_type"] == "Opening Stock"
    assert movements[0]["quantity"] == 25

    # Safe deletion should be blocked because a movement exists
    res = client.delete(f"/api/products/{prod_id}")
    assert res.status_code == 400
    assert "archive" in res.get_json()["error"].lower()

    # 3. Archive product
    res = client.post(f"/api/products/{prod_id}/archive")
    assert res.status_code == 200
    assert res.get_json()["data"]["is_active"] is False

    # Active list should not include it by default
    res = client.get("/api/products?status=active")
    assert not any(p["id"] == prod_id for p in res.get_json()["data"]["items"])

    # Archived filter should include it
    res = client.get("/api/products?status=archived")
    assert any(p["id"] == prod_id for p in res.get_json()["data"]["items"])

    # 4. Reactivate product
    res = client.post(f"/api/products/{prod_id}/reactivate")
    assert res.status_code == 200
    assert res.get_json()["data"]["is_active"] is True


def test_inventory_underflow_prevention_and_adjustment(client):
    res = client.post("/api/products", json={
        "sku": "UNDERFLOW-01",
        "name": "Underflow Shield",
        "category": "Hardware",
        "unit_cost": 20.0,
    })
    prod_id = res.get_json()["data"]["id"]

    # Initial stock is 0. Attempting Stock Out of 5 should fail (no negative stock)
    res = client.post("/api/stock/movements", json={
        "product_id": prod_id,
        "movement_type": "Stock Out",
        "quantity": 5,
        "movement_date": "2026-10-20",
    })
    assert res.status_code == 400
    assert "below zero" in res.get_json()["error"].lower() or "cannot reduce" in res.get_json()["error"].lower()

    # Add 10 units via Stock In
    res = client.post("/api/stock/movements", json={
        "product_id": prod_id,
        "movement_type": "Stock In",
        "quantity": 10,
        "movement_date": "2026-10-20",
    })
    assert res.status_code == 201

    # Apply negative adjustment of -4 -> stock becomes 6
    res = client.post("/api/stock/movements", json={
        "product_id": prod_id,
        "movement_type": "Adjustment",
        "quantity": -4,
        "movement_date": "2026-10-20",
        "description": "Damaged goods cycle count",
    })
    assert res.status_code == 201

    prod_check = client.get(f"/api/products/{prod_id}").get_json()["data"]
    assert prod_check["current_stock"] == 6

    # Attempting negative adjustment of -10 should fail (6 - 10 = -4 < 0)
    res = client.post("/api/stock/movements", json={
        "product_id": prod_id,
        "movement_type": "Adjustment",
        "quantity": -10,
        "movement_date": "2026-10-20",
        "description": "Excessive loss",
    })
    assert res.status_code == 400
    assert "below zero" in res.get_json()["error"].lower()


def test_purchase_order_lifecycle_and_idempotent_receive(client):
    # Setup supplier & product
    sup_res = client.post("/api/suppliers", json={"name": "Logistics Global Direct", "email": "info@logistics.com"})
    sup_id = sup_res.get_json()["data"]["id"]

    prod_res = client.post("/api/products", json={"sku": "PO-TEST-01", "name": "Bulk Cargo", "category": "Logistics", "unit_cost": 100.0})
    prod_id = prod_res.get_json()["data"]["id"]

    # 1. Create Purchase Order in Draft
    po_res = client.post("/api/purchase-orders", json={
        "supplier_id": sup_id,
        "order_date": "2026-10-01",
        "expected_delivery_date": "2026-10-10",
        "status": "Draft",
        "items": [{"product_id": prod_id, "quantity": 15, "unit_cost": 95.0}],
    })
    assert po_res.status_code == 201
    po_id = po_res.get_json()["data"]["id"]

    # 2. Edit draft order (change quantity to 20)
    edit_res = client.put(f"/api/purchase-orders/{po_id}", json={
        "supplier_id": sup_id,
        "items": [{"product_id": prod_id, "quantity": 20, "unit_cost": 95.0}],
    })
    assert edit_res.status_code == 200
    assert edit_res.get_json()["data"]["items"][0]["quantity"] == 20

    # 3. Advance Draft -> Pending -> Approved -> Shipped
    assert client.patch(f"/api/purchase-orders/{po_id}/status", json={"status": "Pending"}).status_code == 200
    assert client.patch(f"/api/purchase-orders/{po_id}/status", json={"status": "Approved"}).status_code == 200
    assert client.patch(f"/api/purchase-orders/{po_id}/status", json={"status": "Shipped"}).status_code == 200

    # 4. Receive Purchase Order on 2026-10-08 (on-time: expected 2026-10-10)
    rec_res = client.post(f"/api/purchase-orders/{po_id}/receive", json={"received_date": "2026-10-08"})
    assert rec_res.status_code == 200
    order_data = rec_res.get_json()["data"]
    assert order_data["status"] == "Received"
    assert order_data["received_date"] == "2026-10-08"

    # Verify inventory was increased by exactly 20
    prod_check = client.get(f"/api/products/{prod_id}").get_json()["data"]
    assert prod_check["current_stock"] == 20

    # Verify stock movement was created and linked to PO
    movements_res = client.get("/api/stock/movements").get_json()["data"]
    po_movements = [m for m in movements_res if m["reference"] == f"PO-{po_id}"]
    assert len(po_movements) == 1
    assert po_movements[0]["quantity"] == 20
    assert po_movements[0]["movement_type"] == "Stock In"

    # 5. Idempotency test: attempt receiving the same order again
    dup_res = client.post(f"/api/purchase-orders/{po_id}/receive", json={"received_date": "2026-10-08"})
    assert dup_res.status_code == 400
    assert "already received" in dup_res.get_json()["error"].lower()

    # Verify inventory was NOT double-counted
    prod_check2 = client.get(f"/api/products/{prod_id}").get_json()["data"]
    assert prod_check2["current_stock"] == 20

    # 6. Supplier delivery rate verification: 1 order eligible, received 10-08 <= expected 10-10 -> 100% on time
    perf_res = client.get("/api/analytics/suppliers").get_json()["data"]
    sup_perf = next(s for s in perf_res if s["supplier_id"] == sup_id)
    assert sup_perf["delivered_orders"] == 1
    assert sup_perf["on_time_orders"] == 1
    assert sup_perf["on_time_delivery"] == 100.0


def test_supplier_archival_preserves_po_history(client):
    sup_res = client.post("/api/suppliers", json={"name": "Legacy Tech Ltd"})
    sup_id = sup_res.get_json()["data"]["id"]

    prod_res = client.post("/api/products", json={"sku": "LEGACY-01", "name": "Legacy Part", "category": "Parts", "unit_cost": 30.0})
    prod_id = prod_res.get_json()["data"]["id"]

    po_res = client.post("/api/purchase-orders", json={
        "supplier_id": sup_id,
        "status": "Pending",
        "items": [{"product_id": prod_id, "quantity": 5}],
    })
    po_id = po_res.get_json()["data"]["id"]

    # Permanent delete of supplier should be rejected
    del_res = client.delete(f"/api/suppliers/{sup_id}")
    assert del_res.status_code == 400

    # Archive supplier
    arch_res = client.post(f"/api/suppliers/{sup_id}/archive")
    assert arch_res.status_code == 200

    # PO history remains readable with supplier name
    po_view = client.get(f"/api/purchase-orders/{po_id}").get_json()["data"]
    assert po_view["supplier_name"] == "Legacy Tech Ltd"


def test_numerical_reconciliation_dashboard_and_analytics(client):
    # Create controlled fixture
    p1 = client.post("/api/products", json={"sku": "REC-01", "name": "Item A", "category": "Cat A", "unit_cost": 10.0, "safety_stock": 5}).get_json()["data"]
    p2 = client.post("/api/products", json={"sku": "REC-02", "name": "Item B", "category": "Cat B", "unit_cost": 25.0, "safety_stock": 20}).get_json()["data"]

    # Stock for Item A: 10 units (value: 10 * 10 = 100.0)
    client.post("/api/stock/movements", json={
        "product_id": p1["id"],
        "movement_type": "Opening Stock",
        "quantity": 10,
        "movement_date": "2026-10-20",
    })

    # Stock for Item B: 5 units (value: 5 * 25 = 125.0, below safety stock 20 -> low stock!)
    client.post("/api/stock/movements", json={
        "product_id": p2["id"],
        "movement_type": "Opening Stock",
        "quantity": 5,
        "movement_date": "2026-10-20",
    })

    # Expected total inventory value: 100.0 + 125.0 = 225.0
    dash_res = client.get("/api/analytics/dashboard").get_json()["data"]
    assert dash_res["total_inventory_value"] == 225.0
    assert dash_res["low_stock_products"] >= 1  # Item B is <= reorder_point

    # Add demand records for Item A: 10 units on day 1, 15 units on day 2
    client.post("/api/demand", json={"product_id": p1["id"], "demand_date": "2026-10-10", "quantity": 10})
    client.post("/api/demand", json={"product_id": p1["id"], "demand_date": "2026-10-11", "quantity": 15})

    demand_analytics = client.get(f"/api/analytics/demand?product_id={p1['id']}").get_json()["data"]
    assert demand_analytics["total_demand"] == 25
    assert len(demand_analytics["chart"]) == 2
