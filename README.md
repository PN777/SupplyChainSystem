# Supply Chain Optimization & Inventory Forecasting System

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-lightgrey.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.x-38bdf8.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A full-stack, enterprise-grade inventory management and supply chain optimization dashboard. Built with a robust **Flask (Python)** REST API backend and a responsive **React + TypeScript + Tailwind CSS** frontend, this system delivers real-time inventory visibility, automated reorder-point calculations, explainable demand forecasting, purchase order lifecycles, and supplier performance tracking.

---

## Table of Contents

- [Key Features](#key-features)
- [Screenshots & UI Walkthrough](#screenshots--ui-walkthrough)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Prerequisites](#prerequisites)
- [Step-by-Step Setup Guide](#step-by-step-setup-guide)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Database Setup (SQLite or MySQL)](#4-database-setup-sqlite-or-mysql)
  - [5. Frontend Setup](#5-frontend-setup)
- [Running the Application](#running-the-application)
- [Step-by-Step Guided Walkthrough](#step-by-step-guided-walkthrough)
- [API Reference](#api-reference)
- [CSV Import & Export Format](#csv-import--export-format)
- [Testing & Quality Verification](#testing--quality-verification)
- [Project Directory Structure](#project-directory-structure)
- [License](#license)

---

## Key Features

- **Executive KPI Dashboard:** Real-time summary cards for total inventory valuation, out-of-stock items, critical reorder alerts, and pending purchase orders.
- **Explainable Demand Forecasting:** Moving-average statistical projection with dynamic lookback windows (e.g., 30 days) and configurable horizons (7, 14, 30 days) to prevent stockouts and overstocking.
- **Automated Reorder-Point Intelligence:** Calculated using average daily demand, supplier lead time, and safety stock thresholds.
- **Inventory & Stock Movement Audit Log:** Record adjustments, stock-in, stock-out, and returns with printable, downloadable PDF/print receipt views.
- **Purchase Order Workflow:** Multi-line order creation, supplier attribution, automated expected delivery calculation, and strict one-time stock receiving transactions.
- **Supplier Performance Analytics:** Real-time on-time delivery rates, average lead time metrics, and supplier reliability ratings.
- **Transactional CSV Bulk Import/Export:** Import products, suppliers, demand records, and movements with strict error validation and atomicity.
- **Modern Responsive UI:** Clean glassmorphism styling, dark/light theme support, responsive mobile navigation, and interactive charts powered by Recharts.

---

## Screenshots & UI Walkthrough

### 1. Executive Dashboard & Real-Time Alerts
Comprehensive overview of stock status, low-stock warnings, and demand trends:
![Dashboard Overview](./screenshots/ui-check-desktop-dashboard.png)

### 2. Purchase Order Management
Manage order lifecycles, itemized receipts, and supplier assignments:
![Purchase Orders](./screenshots/ui-check-desktop-po.png)

### 3. Analytics & Demand Forecasting Trends
Analyze historical sales patterns, seasonal shifts, and stock valuation:
![Analytics & Forecasting](./screenshots/ui-check-analytics-top.png)

### 4. Product Management & Supplier Linking
Add catalog items with unit costs, lead times, safety stocks, and inline supplier setup:
![Product Modal](./screenshots/ui-check-product-new-supplier.png)

### 5. Mobile-Responsive Experience
Fully responsive navigation, data tables, and quick-filter toolbars designed for warehouse tablets and mobile devices:
<p align="center">
  <img src="./screenshots/ui-check-mobile-topbar.png" width="30%" alt="Mobile Navigation" />
  <img src="./screenshots/ui-check-mobile-table.png" width="30%" alt="Mobile Table" />
  <img src="./screenshots/ui-check-mobile-filters.png" width="30%" alt="Mobile Filters" />
</p>

---

## Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│                   React + TypeScript UI                │
│    (Tailwind CSS, Lucide Icons, Recharts, Vite)        │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON REST APIs
┌───────────────────────────▼────────────────────────────┐
│                    Flask REST API                      │
│       (Flask-SQLAlchemy, Flask-CORS, PyMySQL)          │
└───────────────────────────┬────────────────────────────┘
                            │ ORM
┌───────────────────────────▼────────────────────────────┐
│              Database (SQLite or MySQL 8)              │
│   (Products, Suppliers, Movements, Demand, Orders)     │
└────────────────────────────────────────────────────────┘
```

- **Backend:** Python 3.11+, Flask, Flask-SQLAlchemy, PyMySQL, python-dotenv
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts
- **Database:** SQLite (default zero-configuration mode) or MySQL 8.x
- **Testing:** Pytest, SQLite in-memory test harnesses

---

## Prerequisites

Before starting, ensure you have the following installed on your machine:

1. **Python 3.11+** (`python3 --version`)
2. **Node.js 18+** & **npm** (`node -v` and `npm -v`)
3. **Git** (`git --version`)
4. *(Optional)* **MySQL 8.x** (only required if deploying with MySQL instead of SQLite)

---

## Step-by-Step Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/PN777/SupplyChainSystem.git
cd SupplyChainSystem
```

---

### 2. Backend Setup

Open a terminal and navigate to the `backend/` directory:

```bash
cd backend

# Create a virtual environment
python3 -m venv .venv

# Activate the virtual environment:
# On macOS/Linux:
source .venv/bin/activate
# On Windows (Command Prompt):
# .venv\Scripts\activate.bat
# On Windows (PowerShell):
# .venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

### 3. Configure Environment Variables

#### Backend Configuration:
Create your `backend/.env` file from the provided `.env.example`:

```bash
cp .env.example .env
```

Default contents of `backend/.env`:
```env
FLASK_ENV=development
SECRET_KEY=replace-with-a-secure-secret-key
# Leave DATABASE_URL blank or commented out to use the built-in SQLite database:
DATABASE_URL=sqlite:///app.db
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

#### Frontend Configuration:
Navigate to `frontend/` and create `frontend/.env`:

```bash
cd ../frontend
cp .env.example .env
```

Contents of `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

---

### 4. Database Setup (SQLite or MySQL)

You can choose either SQLite (ready immediately) or MySQL:

#### Option A: SQLite (Quickstart - Recommended)
No configuration or server needed! The application automatically creates the database schema (`app.db`) upon running the backend.

#### Option B: MySQL 8.x (Production / External DB)
1. Ensure your MySQL server is running.
2. Update `backend/.env` with your connection string:
   ```env
   DATABASE_URL=mysql+pymysql://username:password@localhost:3306/supply_chain_system
   ```
3. Initialize the database schema and seed data using the provided SQL files:
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS supply_chain_system;"
   mysql -u root -p supply_chain_system < database/schema.sql
   mysql -u root -p supply_chain_system < database/seed.sql
   ```

---

### 5. Frontend Setup

In a new terminal window or tab, install the frontend dependencies:

```bash
cd frontend
npm install
```

---

## Running the Application

### Step 1: Start the Backend API

From the `backend/` directory (with your virtual environment activated):

```bash
cd backend
source .venv/bin/activate
python run.py
```

- The API server will start at: `http://localhost:5001`
- Test health check: Visit `http://localhost:5001/api/health`

> **Note for macOS users:** The API runs on port `5001` by default to avoid conflicts with macOS AirPlay Receiver which binds to port `5000`.

### Step 2: Start the Frontend UI

From the `frontend/` directory:

```bash
cd frontend
npm run dev
```

- The dashboard will be accessible at: `http://localhost:5173`
- Open `http://localhost:5173` in your browser.

---

## Step-by-Step Guided Walkthrough

Once the application is running, follow this guided test run to experience the full operational workflow:

1. **Dashboard Overview:**
   - Navigate to `http://localhost:5173/`.
   - Review the headline metrics: *Total Inventory Value*, *Items in Stock*, *Critical Alerts*, and *Demand Forecasts*.
2. **Add a Supplier:**
   - Go to **Suppliers** (`/suppliers`) & click **Add Supplier**.
   - Enter supplier name, email, phone, and lead time.
3. **Register a Product:**
   - Go to **Products** (`/products`) & click **Add Product**.
   - Enter SKU (e.g. `PRD-001`), name, unit cost, safety stock, and select your supplier.
4. **Record a Stock Movement:**
   - Go to **Stock Movements** (`/stock-movements`).
   - Log a `Stock In` transaction of 50 units.
   - Verify that your stock balance increases and view the printable transaction receipt.
5. **Simulate Demand History:**
   - Go to **Demand Forecasting** (`/forecasting`).
   - Add dated demand entries (or import `database/sample_data/demand_records_template.csv`).
   - Observe how the explainable moving-average baseline calculates projected demand and reorder points.
6. **Create and Receive a Purchase Order:**
   - Go to **Purchase Orders** (`/purchase-orders`) & click **New Purchase Order**.
   - Add product line items and submit as *Pending*.
   - Once items arrive, click **Receive Order**. Stock levels increment atomically and the order status updates to *Received*.
7. **Analyze Reports:**
   - Head over to **Analytics** (`/analytics`) to inspect stock turnover, supplier on-time delivery rates, and historical demand charts.

---

## API Reference

All backend endpoints are prefixed with `/api`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Backend and database connectivity status |
| `GET`, `POST` | `/products` | List all products or create a new product |
| `GET`, `PUT`, `DELETE`| `/products/<id>` | Retrieve, update, or remove a product |
| `POST`, `GET` | `/products/import`, `/export` | Batch CSV import / CSV export for products |
| `GET`, `POST` | `/suppliers` | List or create suppliers |
| `GET`, `PUT`, `DELETE`| `/suppliers/<id>` | Retrieve, update, or delete a supplier |
| `GET`, `POST` | `/purchase-orders` | List purchase orders or draft a new order |
| `GET` | `/purchase-orders/<id>` | View purchase order line items and status |
| `POST` | `/purchase-orders/<id>/receive`| Atomically receive PO items into inventory |
| `POST` | `/purchase-orders/<id>/cancel` | Cancel a pending purchase order |
| `GET`, `POST` | `/stock/movements` | List stock ledger or record new movement |
| `GET` | `/stock/movements/<id>/receipt`| Retrieve receipt payload for printing |
| `GET` | `/stock/summary` | Get aggregated inventory stock levels |
| `GET` | `/stock/alerts` | List items below reorder point or safety stock |
| `GET`, `POST` | `/demand` | Query historical demand records or add entry |
| `POST`, `GET` | `/demand/import`, `/export` | Batch CSV import / export for demand history |
| `GET` | `/forecast` | Generate system-wide inventory forecast |
| `GET` | `/forecast/<product_id>` | Product-specific forecast & reorder points |
| `GET` | `/analytics/dashboard` | Aggregated executive KPIs |
| `GET` | `/analytics/inventory` | Stock valuation & category distribution |
| `GET` | `/analytics/suppliers` | Supplier reliability & lead-time compliance |
| `GET` | `/analytics/demand` | Aggregated sales volume trends |
| `GET`, `POST` | `/settings` | System-wide configuration (lookback days, horizon) |

---

## CSV Import & Export Format

Sample CSV templates are available in the [`database/sample_data/`](./database/sample_data/) folder:

- **Products (`products_template.csv`):** `sku, name, category, unit_cost, lead_time_days, safety_stock, max_stock, supplier_name`
- **Suppliers (`suppliers_template.csv`):** `name, phone, email, address, city, country`
- **Demand Records (`demand_records_template.csv`):** `product_sku, demand_date, quantity`
- **Stock Movements (`stock_movements_template.csv`):** `product_sku, movement_date, movement_type, quantity, reference, description`

> **Note:** The CSV importer runs in a database transaction. If any row contains invalid data or formatting errors, the entire file is rejected with a descriptive error message to prevent corrupted data.

---

## Testing & Quality Verification

### Run Backend Unit & Integration Tests

From the `backend/` folder:

```bash
cd backend
source .venv/bin/activate
python3 -m pytest -v
```

This executes 27 comprehensive test suites covering:
- Database transactions & atomic rollbacks
- Purchase order fulfillment & inventory updates
- Reorder point formulas and moving-average forecasting calculations
- CSV batch importer validation
- REST API response status codes and schema contracts

### Validate Frontend Compilation

From the `frontend/` folder:

```bash
cd frontend
npm run build
```

This verifies TypeScript typing, syntax errors, and builds production bundles.

---

## Project Directory Structure

```text
SupplyChainSystem/
├── backend/
│   ├── app/
│   │   ├── models/            # SQLAlchemy database models
│   │   ├── routes/            # Flask REST API blueprint endpoints
│   │   ├── services/          # Business logic (Forecasting, PO, Inventory)
│   │   ├── utils/             # Data validators and error handlers
│   │   ├── config.py          # App configuration & environment loader
│   │   └── extensions.py      # SQLAlchemy & database extensions
│   ├── tests/                 # Pytest test cases
│   ├── requirements.txt       # Python dependencies
│   └── run.py                 # Flask server runner (Port 5001)
├── frontend/
│   ├── src/
│   │   ├── components/        # UI widgets, layout, cards, modal dialogues
│   │   ├── pages/             # Dashboard, Inventory, PO, Analytics, Forecast
│   │   ├── services/          # Axios API communication services
│   │   ├── types/             # TypeScript domain definitions
│   │   ├── App.tsx            # Route configuration
│   │   └── main.tsx           # React entrypoint
│   ├── package.json           # Frontend dependencies
│   ├── vite.config.ts         # Vite bundler configuration
│   └── index.html             # Single-page application root
├── database/
│   ├── schema.sql             # Full DDL schema for MySQL
│   ├── seed.sql               # Deterministic seed data
│   └── sample_data/           # Reusable CSV import templates
├── screenshots/               # UI preview captures for documentation
├── LICENSE                    # MIT License
└── README.md                  # Project documentation & guides
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
