USE supply_chain_system;

DELETE FROM stock_movements;
DELETE FROM demand_records;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM products;
DELETE FROM suppliers;
DELETE FROM settings;

ALTER TABLE suppliers AUTO_INCREMENT = 1;
ALTER TABLE products AUTO_INCREMENT = 1;
ALTER TABLE purchase_orders AUTO_INCREMENT = 1;
ALTER TABLE purchase_order_items AUTO_INCREMENT = 1;
ALTER TABLE stock_movements AUTO_INCREMENT = 1;
ALTER TABLE demand_records AUTO_INCREMENT = 1;
ALTER TABLE settings AUTO_INCREMENT = 1;

INSERT INTO suppliers (name, email, phone, address) VALUES
('Northwind Components', 'orders@northwindcomponents.com', '555-0101', '120 Harbor Road, Seattle, WA'),
('BluePeak Logistics', 'ops@bluepeaklogistics.com', '555-0102', '88 Ridge Avenue, Austin, TX'),
('Harborline Supply Co.', 'service@harborlinesupply.com', '555-0103', '45 Dock Street, Houston, TX'),
('Summit Industrial', 'procurement@summitindustrial.com', '555-0104', '14 Quarry Lane, Denver, CO'),
('Vertex Retail Partners', 'team@vertexretailpartners.com', '555-0105', '212 Market Street, Boston, MA');

INSERT INTO products (sku, name, category, unit_cost, lead_time_days, safety_stock, max_stock, supplier_id) VALUES
('SKU-1001', 'Alpha Headset', 'Electronics', 59.99, 7, 15, 200, 1),
('SKU-1002', 'Beta Keyboard', 'Electronics', 89.50, 6, 20, 180, 1),
('SKU-1003', 'Gamma Mouse', 'Electronics', 34.99, 5, 18, 160, 2),
('SKU-1004', 'Delta Monitor', 'Displays', 219.00, 10, 12, 140, 2),
('SKU-1005', 'Epsilon Dock', 'Accessories', 49.00, 4, 25, 170, 3),
('SKU-1006', 'Zeta Cable', 'Accessories', 12.50, 3, 30, 220, 3),
('SKU-1007', 'Eta Battery Pack', 'Power', 28.75, 8, 10, 150, 4),
('SKU-1008', 'Theta USB Hub', 'Connectivity', 26.25, 5, 20, 175, 4),
('SKU-1009', 'Iota Printer', 'Office', 142.00, 12, 15, 110, 5),
('SKU-1010', 'Kappa Scanner', 'Office', 185.00, 9, 10, 120, 5),
('SKU-1011', 'Lambda Chair', 'Furniture', 220.00, 14, 8, 100, 1),
('SKU-1012', 'Mu Desk', 'Furniture', 460.00, 18, 5, 90, 2),
('SKU-1013', 'Nu Storage Bin', 'Warehouse', 57.00, 6, 18, 180, 3),
('SKU-1014', 'Xi Pallet', 'Warehouse', 65.00, 7, 16, 150, 4),
('SKU-1015', 'Omicron Cart', 'Warehouse', 98.00, 9, 12, 130, 5);

INSERT INTO settings (`key`, value) VALUES
('default_forecast_horizon', '7'),
('demand_lookback_days', '30'),
('default_safety_stock', '15'),
('max_stock_threshold', '180'),
('theme', 'light');

INSERT INTO purchase_orders (supplier_id, order_date, expected_delivery_date, received_date, status) VALUES
(1, '2025-01-12', '2025-01-19', '2025-01-18', 'Received'),
(2, '2025-02-04', '2025-02-11', '2025-02-16', 'Received'),
(3, '2025-03-03', '2025-03-10', NULL, 'Pending'),
(4, '2025-04-08', '2025-04-16', '2025-04-15', 'Received'),
(5, '2025-05-15', '2025-05-22', NULL, 'Shipped');

INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) VALUES
(1, 1, 30, 59.99),
(1, 3, 18, 34.99),
(2, 4, 12, 219.00),
(2, 8, 25, 26.25),
(3, 7, 15, 28.75),
(4, 9, 10, 142.00),
(4, 11, 8, 220.00),
(5, 10, 12, 185.00);

INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, reference, description, purchase_order_id) VALUES
(1, '2025-01-02', 'Stock In', 22, 'opening', 'Opening stock', NULL),
(2, '2025-01-04', 'Stock In', 10, 'opening', 'Opening stock', NULL),
(3, '2025-01-06', 'Stock In', 18, 'opening', 'Opening stock', NULL),
(4, '2025-01-07', 'Stock In', 11, 'opening', 'Opening stock', NULL),
(5, '2025-02-01', 'Stock In', 28, 'opening', 'Opening stock', NULL),
(1, '2025-01-17', 'Stock Out', 6, 'sale', 'Daily sales movement', NULL),
(3, '2025-01-22', 'Stock Out', 7, 'sale', 'Daily sales movement', NULL),
(4, '2025-02-08', 'Stock Out', 5, 'sale', 'Daily sales movement', NULL),
(1, '2025-02-10', 'Adjustment', 4, 'audit', 'Inventory adjustment', NULL),
(7, '2025-02-19', 'Stock In', 16, 'PO-2', 'Received purchase order', 2),
(7, '2025-03-05', 'Stock Out', 9, 'sale', 'Daily sales movement', NULL),
(9, '2025-04-18', 'Stock In', 12, 'PO-4', 'Received purchase order', 4),
(10, '2025-04-20', 'Stock In', 8, 'PO-5', 'Received purchase order', 5),
(10, '2025-05-01', 'Stock Out', 4, 'sale', 'Daily sales movement', NULL),
(12, '2025-05-05', 'Stock Out', 6, 'sale', 'Daily sales movement', NULL),
(15, '2025-05-20', 'Stock Out', 9, 'sale', 'Daily sales movement', NULL),
(15, '2025-05-25', 'Return', 5, 'customer-return', 'Customer return', NULL);

INSERT INTO demand_records (product_id, demand_date, quantity) VALUES
(1, '2025-01-01', 4), (1, '2025-01-03', 5), (1, '2025-01-05', 4), (1, '2025-01-07', 6), (1, '2025-01-09', 5),
(1, '2025-01-11', 4), (1, '2025-01-13', 6), (1, '2025-01-15', 5), (1, '2025-01-17', 7), (1, '2025-01-19', 6),
(1, '2025-01-21', 5), (1, '2025-01-23', 4), (1, '2025-01-25', 6), (1, '2025-01-27', 7), (1, '2025-01-29', 5),
(1, '2025-02-01', 8), (1, '2025-02-03', 6), (1, '2025-02-05', 5), (1, '2025-02-07', 7), (1, '2025-02-09', 8),
(1, '2025-02-11', 7), (1, '2025-02-13', 6), (1, '2025-02-15', 5), (1, '2025-02-17', 7), (1, '2025-02-19', 8),
(1, '2025-02-21', 6), (1, '2025-02-23', 7), (1, '2025-02-25', 8), (1, '2025-02-27', 6), (1, '2025-03-01', 7),
(2, '2025-01-02', 2), (2, '2025-01-05', 4), (2, '2025-01-08', 2), (2, '2025-01-11', 3), (2, '2025-01-14', 5),
(2, '2025-01-17', 4), (2, '2025-01-20', 3), (2, '2025-01-23', 5), (2, '2025-01-26', 4), (2, '2025-01-29', 2),
(2, '2025-02-01', 3), (2, '2025-02-04', 5), (2, '2025-02-07', 4), (2, '2025-02-10', 3), (2, '2025-02-13', 5),
(2, '2025-02-16', 4), (2, '2025-02-19', 3), (2, '2025-02-22', 5), (2, '2025-02-25', 4), (2, '2025-02-28', 3),
(3, '2025-01-01', 3), (3, '2025-01-04', 5), (3, '2025-01-07', 6), (3, '2025-01-10', 4), (3, '2025-01-13', 3),
(3, '2025-01-16', 4), (3, '2025-01-19', 5), (3, '2025-01-22', 6), (3, '2025-01-25', 4), (3, '2025-01-28', 5),
(3, '2025-02-01', 7), (3, '2025-02-04', 5), (3, '2025-02-07', 4), (3, '2025-02-10', 6), (3, '2025-02-13', 5),
(3, '2025-02-16', 4), (3, '2025-02-19', 6), (3, '2025-02-22', 5), (3, '2025-02-25', 4), (3, '2025-02-28', 5),
(4, '2025-01-03', 2), (4, '2025-01-06', 3), (4, '2025-01-09', 2), (4, '2025-01-12', 4), (4, '2025-01-15', 2),
(4, '2025-01-18', 3), (4, '2025-01-21', 4), (4, '2025-01-24', 2), (4, '2025-01-27', 3), (4, '2025-01-30', 2),
(4, '2025-02-02', 4), (4, '2025-02-05', 3), (4, '2025-02-08', 2), (4, '2025-02-11', 3), (4, '2025-02-14', 4),
(4, '2025-02-17', 2), (4, '2025-02-20', 3), (4, '2025-02-23', 4), (4, '2025-02-26', 2), (4, '2025-03-01', 3),
(5, '2025-01-04', 4), (5, '2025-01-07', 5), (5, '2025-01-10', 6), (5, '2025-01-13', 5), (5, '2025-01-16', 4),
(5, '2025-01-19', 5), (5, '2025-01-22', 6), (5, '2025-01-25', 5), (5, '2025-01-28', 4), (5, '2025-01-31', 5),
(5, '2025-02-03', 6), (5, '2025-02-06', 5), (5, '2025-02-09', 4), (5, '2025-02-12', 6), (5, '2025-02-15', 5),
(5, '2025-02-18', 4), (5, '2025-02-21', 5), (5, '2025-02-24', 6), (5, '2025-02-27', 5), (5, '03-01', 4);

SELECT 1;
