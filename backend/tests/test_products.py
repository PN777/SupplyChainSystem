def test_product_creation_and_editing(client):
    response = client.post(
        "/api/products",
        json={
            "sku": "SKU-1001",
            "name": "Laptop",
            "category": "Electronics",
            "unit_cost": 900.0,
            "lead_time_days": 7,
            "safety_stock": 10,
            "max_stock": 100,
        },
    )
    assert response.status_code == 201
    payload = response.get_json()
    assert payload["data"]["sku"] == "SKU-1001"

    response = client.get("/api/products")
    assert response.status_code == 200
    assert response.get_json()["data"]["items"][0]["name"] == "Laptop"

    product_id = payload["data"]["id"]
    response = client.put(
        f"/api/products/{product_id}",
        json={
            "sku": "SKU-1001",
            "name": "Gaming Laptop",
            "category": "Electronics",
            "unit_cost": 950.0,
            "lead_time_days": 8,
            "safety_stock": 12,
            "max_stock": 120,
        },
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["name"] == "Gaming Laptop"


def test_duplicate_sku_rejected(client):
    client.post(
        "/api/products",
        json={
            "sku": "SKU-2001",
            "name": "Tablet",
            "category": "Electronics",
            "unit_cost": 250.0,
            "lead_time_days": 5,
            "safety_stock": 10,
            "max_stock": 50,
        },
    )

    response = client.post(
        "/api/products",
        json={
            "sku": "SKU-2001",
            "name": "Tablet Pro",
            "category": "Electronics",
            "unit_cost": 260.0,
            "lead_time_days": 5,
            "safety_stock": 10,
            "max_stock": 60,
        },
    )
    assert response.status_code == 400
    assert "already exists" in response.get_json()["error"]


def test_demand_record_crud_and_validation(client):
    product_response = client.post(
        "/api/products",
        json={
            "sku": "DEMAND-1",
            "name": "Demand Test Product",
            "category": "Electronics",
            "unit_cost": 50.0,
            "lead_time_days": 7,
            "safety_stock": 5,
            "max_stock": 100,
        },
    )
    product_id = product_response.get_json()["data"]["id"]

    create_response = client.post(
        "/api/demand",
        json={
            "product_id": product_id,
            "demand_date": "2026-01-10",
            "quantity": 15,
        },
    )
    assert create_response.status_code == 201
    demand_id = create_response.get_json()["data"]["id"]

    list_response = client.get(f"/api/demand?product_id={product_id}")
    assert list_response.status_code == 200
    assert list_response.get_json()["data"][0]["quantity"] == 15

    update_response = client.put(
        f"/api/demand/{demand_id}",
        json={
            "demand_date": "2026-01-12",
            "quantity": 22,
        },
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["data"]["quantity"] == 22

    invalid_response = client.post(
        "/api/demand",
        json={
            "product_id": product_id,
            "demand_date": "2026-01-12",
            "quantity": -3,
        },
    )
    assert invalid_response.status_code == 400
    assert "negative" in invalid_response.get_json()["error"].lower()

    delete_response = client.delete(f"/api/demand/{demand_id}")
    assert delete_response.status_code == 200
    assert delete_response.get_json()["message"] == "Demand record deleted"
