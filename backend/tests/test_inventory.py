def test_negative_stock_prevention(client):
    response = client.post(
        "/api/stock/movements",
        json={
            "product_id": 999,
            "movement_type": "Stock Out",
            "quantity": 10,
            "reference": "test",
            "description": "should fail",
        },
    )
    assert response.status_code == 404


def test_stock_movement_consistency(client):
    product_response = client.post(
        "/api/products",
        json={
            "sku": "INV-100",
            "name": "Inventory Item",
            "category": "Inventory",
            "unit_cost": 15.0,
            "lead_time_days": 5,
            "safety_stock": 5,
            "max_stock": 100,
        },
    )
    product_id = product_response.get_json()["data"]["id"]

    response = client.post(
        "/api/stock/movements",
        json={
            "product_id": product_id,
            "movement_type": "Stock In",
            "quantity": 25,
            "reference": "initial-stock",
            "description": "initial",
        },
    )
    assert response.status_code == 201

    summary = client.get("/api/stock/summary").get_json()
    assert summary["products"][0]["stock"] == 25

    response = client.post(
        "/api/stock/movements",
        json={
            "product_id": product_id,
            "movement_type": "Stock Out",
            "quantity": 30,
            "reference": "sale",
            "description": "sale",
        },
    )
    assert response.status_code == 400
    assert "Cannot reduce stock below zero" in response.get_json()["error"]
