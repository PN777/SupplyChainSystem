export type Product = {
  id: number
  sku: string
  name: string
  category: string
  unit_cost: number
  lead_time_days: number
  safety_stock: number
  max_stock: number
  supplier_id?: number | null
  supplier_name?: string | null
  is_active?: boolean
  current_stock: number
  reorder_point: number
}

export type Supplier = {
  id: number
  name: string
  email?: string
  phone?: string
  address?: string
  is_active?: boolean
  delivered_orders?: number
  on_time_orders?: number
  total_orders?: number
  on_time_delivery?: number | null
}

export type PurchaseOrder = {
  id: number
  supplier_id: number
  supplier_name?: string
  status: string
  order_date?: string
  expected_delivery_date?: string
  received_date?: string
  items?: PurchaseOrderItem[]
  total?: number
}

export type PurchaseOrderItem = {
  id: number
  purchase_order_id: number
  product_id: number
  product_name?: string
  product_sku?: string
  quantity: number
  unit_cost: number
  line_total?: number
}

export type StockMovement = {
  id: number
  product_id: number
  product_name?: string
  product_sku?: string
  movement_date: string
  movement_type: string
  quantity: number
  reference?: string
  description?: string
  stock_before?: number
  stock_after?: number
}

export type ForecastRecord = {
  date: string
  quantity: number
}

export type SupplierPerformance = {
  supplier: string
  supplier_id?: number
  on_time_delivery: number | null
  delivered_orders?: number
  on_time_orders?: number
  total_orders?: number
}

export type DashboardMetrics = {
  total_products: number
  total_inventory_value: number
  low_stock_products: number
  out_of_stock_products: number
  pending_purchase_orders: number
  average_supplier_lead_time: number
  total_demand?: number
  demand_trend: ForecastRecord[]
  stock_movement_trend: Array<{ date: string; type: string; quantity: number }>
  supplier_performance: SupplierPerformance[]
}
