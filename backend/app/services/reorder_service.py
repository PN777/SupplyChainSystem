from app.models import Product


def calculate_reorder_point(product):
    if not product.demand_records:
        return product.safety_stock
    start = min(record.demand_date for record in product.demand_records)
    end = max(record.demand_date for record in product.demand_records)
    daily_totals = {}
    for record in product.demand_records:
        daily_totals[record.demand_date] = daily_totals.get(record.demand_date, 0) + record.quantity
    avg_demand = sum(daily_totals.values()) / ((end - start).days + 1)
    return int((avg_demand * product.lead_time_days) + product.safety_stock)


def classify_product(product):
    stock = product.current_stock
    if stock <= 0:
        return "OUT_OF_STOCK"
    if stock <= product.reorder_point:
        return "LOW_STOCK"
    if product.max_stock and stock > product.max_stock:
        return "EXCESS_STOCK"
    return "OK"
