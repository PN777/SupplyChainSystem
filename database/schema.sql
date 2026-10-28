DROP DATABASE IF EXISTS supply_chain_system;
CREATE DATABASE supply_chain_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE supply_chain_system;

CREATE TABLE suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(50),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
  lead_time_days INT NOT NULL DEFAULT 7,
  safety_stock INT NOT NULL DEFAULT 0,
  max_stock INT NOT NULL DEFAULT 0,
  supplier_id INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE purchase_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  received_date DATE,
  status VARCHAR(30) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE purchase_order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE stock_movements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  movement_date DATE NOT NULL,
  movement_type VARCHAR(30) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  reference VARCHAR(150),
  description TEXT,
  purchase_order_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
);

CREATE TABLE demand_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  demand_date DATE NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  `key` VARCHAR(80) NOT NULL UNIQUE,
  value VARCHAR(200) NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
