from app.models import PurchaseOrder


def valid_status_transition(current_status, next_status):
    valid = {
        "Draft": ["Pending", "Cancelled"],
        "Pending": ["Approved", "Cancelled"],
        "Approved": ["Shipped", "Cancelled"],
        "Shipped": ["Received", "Cancelled"],
    }
    return next_status in valid.get(current_status, [])


def get_order_totals(order):
    total = sum(item.quantity * item.unit_cost for item in order.items)
    return float(total)
