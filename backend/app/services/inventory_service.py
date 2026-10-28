from app.extensions import db
from app.models import Product, StockMovement


def get_total_stock(product_id):
    product = db.session.get(Product, product_id)
    if not product:
        return 0
    return sum(
        movement.delta() for movement in product.stock_movements
    )


def create_stock_movement(product_id, movement_type, quantity, reference=None, description=None, purchase_order_id=None):
    product = db.session.get(Product, product_id)
    if not product:
        raise ValueError("Product not found")
    if quantity <= 0:
        raise ValueError("Quantity must be positive")

    movement = StockMovement(
        product_id=product.id,
        movement_type=movement_type,
        quantity=quantity,
        reference=reference,
        description=description,
        purchase_order_id=purchase_order_id,
    )
    db.session.add(movement)
    db.session.flush()
    return movement
