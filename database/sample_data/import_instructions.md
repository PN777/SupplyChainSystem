# Sample import dataset

These CSV files are examples for local demonstration use. They are not a replacement for the user's real data.

## Required columns

### suppliers_template.csv
- name
- phone
- email
- address
- city
- country

### products_template.csv
- sku
- name
- category
- unit_cost
- lead_time_days
- safety_stock
- max_stock
- supplier_name

### demand_records_template.csv
- product_sku
- demand_date
- quantity

### stock_movements_template.csv
- product_sku
- movement_date
- movement_type
- quantity
- reference
- description

## Rules
- Dates must be ISO format: YYYY-MM-DD.
- Quantity values must be numeric and not negative.
- `movement_type` should be one of: `Stock In`, `Stock Out`, `Return`, `Adjustment`.
- Duplicate SKUs and duplicate supplier names should be validated before insert.
- Invalid rows should be rejected with a clear explanation instead of silently dropped.
- Use the same product and supplier IDs already persisted in the database.

## Import flow
1. Prepare CSV data in the documented format.
2. Validate headers and required columns before starting the import.
3. Reject invalid rows and record the reason.
4. Commit only after all rows pass validation.
5. Refresh the affected dashboard and inventory pages.
