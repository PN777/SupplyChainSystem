import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Boxes, CircleDollarSign, ClipboardList, Package2, TrendingUp, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DemandChart } from '../components/dashboard/DemandChart'
import { InventoryAlerts } from '../components/dashboard/InventoryAlerts'
import { InventoryChart } from '../components/dashboard/InventoryChart'
import { StatCard } from '../components/dashboard/StatCard'
import { SupplierChart } from '../components/dashboard/SupplierChart'
import { MainLayout } from '../components/layout/MainLayout'
import { getDashboardAnalytics } from '../services/analyticsService'
import { getStockAlerts, getStockMovements } from '../services/inventoryService'
import { getPurchaseOrders } from '../services/purchaseOrderService'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorMessage } from '../components/common/ErrorMessage'
import type { DashboardMetrics } from '../types'

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const [dashboard, stockAlerts, purchaseOrders, stockMoves] = await Promise.all([
        getDashboardAnalytics(),
        getStockAlerts(),
        getPurchaseOrders(),
        getStockMovements(),
      ])
      setMetrics(dashboard)
      setAlerts(stockAlerts || [])
      setOrders(purchaseOrders || [])
      setMovements(stockMoves || [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading) return <MainLayout title="Dashboard" onRefresh={load}><LoadingSpinner /></MainLayout>
  if (error) return <MainLayout title="Dashboard" onRefresh={load}><ErrorMessage message={error} /></MainLayout>
  if (!metrics) return <MainLayout title="Dashboard" onRefresh={load}><div className="theme-panel p-5 text-[var(--text-muted)]">No dashboard metrics available.</div></MainLayout>

  const purchaseSummary = {
    Pending: orders.filter((order) => order.status === 'Pending').length,
    Approved: orders.filter((order) => order.status === 'Approved').length,
    Shipped: orders.filter((order) => order.status === 'Shipped').length,
    Received: orders.filter((order) => order.status === 'Received').length,
    Cancelled: orders.filter((order) => order.status === 'Cancelled').length,
  }

  const stockOverview = [
    { name: 'Healthy', value: Math.max(metrics.total_products - metrics.low_stock_products - metrics.out_of_stock_products, 0) },
    { name: 'Low stock', value: metrics.low_stock_products },
    { name: 'Out of stock', value: metrics.out_of_stock_products },
  ]

  const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  const formatTimestamp = (value?: string, fallback?: string) => {
    if (!value) return fallback || 'Date not recorded'
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  }
  const relativeTime = (value?: string) => {
    if (!value) return ''
    const elapsed = Date.now() - new Date(value).getTime()
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 7 * 24 * 60 * 60 * 1000) return ''
    const minutes = Math.floor(elapsed / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const recentActivity = [...(movements.map((movement) => ({
    kind: movement.movement_type,
    label: `${movement.movement_type} • ${movement.product_name || 'Product'}`,
    date: movement.movement_date,
    timestamp: movement.created_at,
    description: `${movement.quantity} units${movement.reference ? ` • Ref ${movement.reference}` : ''}${movement.description ? ` • ${movement.description}` : ''}`,
    link: '/stock-movements',
  }))), ...(orders.map((order) => ({
    kind: 'Purchase order',
    label: `Purchase order • ${order.supplier_name || 'Supplier'}`,
    date: order.order_date || order.received_date || '',
    timestamp: order.updated_at || order.created_at,
    description: `PO-${order.id} • ${order.status}${order.items?.length ? ` • ${order.items.map((item: any) => `${item.product_name || 'Product'} × ${item.quantity}`).join(', ')}` : ''}`,
    link: '/purchase-orders',
  })))]
    .sort((a, b) => new Date(b.timestamp || b.date || 0).getTime() - new Date(a.timestamp || a.date || 0).getTime())
    .slice(0, 5)

  const statCards = [
    { title: 'Total Inventory Value', value: currencyFormatter.format(metrics.total_inventory_value || 0), detail: 'Current stock × unit cost', icon: <CircleDollarSign size={18} />, accent: 'violet' },
    { title: 'Total Products', value: metrics.total_products, detail: 'Live catalog', icon: <Package2 size={18} />, accent: 'cyan' },
    { title: 'Low-Stock Products', value: metrics.low_stock_products, detail: 'Needs reorder attention', icon: <AlertTriangle size={18} />, accent: 'amber' },
    { title: 'Out-of-Stock Products', value: metrics.out_of_stock_products, detail: 'No stock on hand', icon: <Boxes size={18} />, accent: 'rose' },
    { title: 'Pending Purchase Orders', value: metrics.pending_purchase_orders, detail: 'Open procurement', icon: <ClipboardList size={18} />, accent: 'emerald' },
    { title: 'Average Supplier Lead Time', value: `${metrics.average_supplier_lead_time || 0} days`, detail: 'Across active suppliers', icon: <Truck size={18} />, accent: 'violet' },
  ]

  return (
    <MainLayout title="Dashboard" onRefresh={load}>
      <div className="dashboard-stack">
        <div className="kpi-grid page-section">
          {statCards.map((card) => (
            <StatCard key={card.title} title={card.title} value={card.value} detail={card.detail} icon={card.icon} accent={card.accent} />
          ))}
        </div>

        <div className="dashboard-hero page-section">
          <div className="dashboard-hero-chart">
            <DemandChart data={metrics.demand_trend} />
          </div>
          <div className="dashboard-hero-alerts">
            <InventoryAlerts alerts={alerts.slice(0, 4)} />
          </div>
        </div>

        <div className="dashboard-grid dashboard-ops page-section">
          <div className="theme-card p-4 xl:p-5 xl:col-span-8 flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="panel-eyebrow">Operational summary</p>
                  <h3 className="mt-1 panel-title">Purchase order summary</h3>
                </div>
                <Link to="/purchase-orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:text-[var(--text-strong)] transition-colors">
                  <span>View all orders</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {Object.entries(purchaseSummary).map(([status, count]) => {
                  const statusColors: Record<string, string> = {
                    Pending: 'border-amber-500/25 bg-amber-500/5 text-amber-300',
                    Approved: 'border-blue-500/25 bg-blue-500/5 text-blue-300',
                    Shipped: 'border-indigo-500/25 bg-indigo-500/5 text-indigo-300',
                    Received: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300',
                    Cancelled: 'border-slate-500/25 bg-slate-500/5 text-slate-400',
                  }
                  return (
                    <div key={status} className={`theme-surface-alt rounded-xl p-3 border ${statusColors[status] || ''}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">{status}</p>
                      <p className="mt-1.5 text-2xl font-bold text-[var(--text-strong)]">{count}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Total Orders</span>
                  <span className="font-semibold text-[var(--text-strong)] text-sm">{orders.length} Orders</span>
                </div>
                <div className="h-6 w-px bg-[var(--border)]" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Procurement Value</span>
                  <span className="font-semibold text-emerald-400 text-sm">
                    {currencyFormatter.format(orders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0))}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-[var(--text-muted)]">Active procurement pipeline</span>
              </div>
            </div>
          </div>

          <div className="theme-card p-4 xl:p-5 xl:col-span-4 flex flex-col justify-between">
            <div>
              <div className="mb-3.5 flex items-center justify-between">
                <div>
                  <p className="panel-eyebrow">Quick actions</p>
                  <h3 className="mt-1 panel-title">Operations</h3>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Add Product', to: '/products', icon: <Package2 size={14} className="text-violet-400" /> },
                  { label: 'Create Purchase Order', to: '/purchase-orders', icon: <ClipboardList size={14} className="text-emerald-400" /> },
                  { label: 'Record Stock Movement', to: '/stock-movements', icon: <Boxes size={14} className="text-cyan-400" /> },
                  { label: 'Add Demand Record', to: '/forecasting', icon: <TrendingUp size={14} className="text-amber-400" /> },
                  { label: 'Generate Forecast', to: '/forecasting', icon: <ArrowRight size={14} className="text-violet-400" /> },
                ].map((action) => (
                  <Link
                    key={action.label}
                    to={action.to}
                    className="theme-surface-alt flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-[var(--text)] transition hover:border-[var(--border-strong)] hover:text-[var(--primary)]"
                  >
                    <span className="flex items-center gap-2.5">
                      {action.icon}
                      <span>{action.label}</span>
                    </span>
                    <ArrowRight size={13} className="text-[var(--text-muted)]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-grid dashboard-chart-row page-section">
          <div className="xl:col-span-6">
            <InventoryChart data={stockOverview} />
          </div>
          <div className="xl:col-span-6">
            <SupplierChart data={metrics.supplier_performance || []} />
          </div>
        </div>

        <div className="dashboard-grid dashboard-activity page-section">
          <div className="theme-card p-4 xl:p-5 xl:col-span-7 flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="panel-eyebrow">Real activity</p>
                  <h3 className="mt-1 panel-title">Recent activity</h3>
                </div>
              </div>
              <div className="space-y-3">
                {recentActivity.length ? recentActivity.map((entry, index) => (
                  <div key={`${entry.label}-${index}`} className="theme-surface-alt flex min-w-0 items-start gap-3 rounded-xl p-3">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-strong)] truncate">{entry.label}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)] truncate">{entry.description}</p>
                    </div>
                    <div className="activity-meta text-right text-[11px] text-[var(--text-muted)] shrink-0">
                      <p>{formatTimestamp(entry.timestamp, entry.date ? formatDate(entry.date) : undefined)}</p>
                      {entry.timestamp && relativeTime(entry.timestamp) && <p className="mt-0.5">{relativeTime(entry.timestamp)}</p>}
                    </div>
                  </div>
                )) : <div className="text-sm text-[var(--text-muted)]">No recent activity to display.</div>}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <Link to="/stock-movements" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:text-[var(--text-strong)] transition-colors">
                <span>View all activity</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="theme-card p-4 xl:p-5 xl:col-span-5 flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="panel-eyebrow">Forecasting</p>
                  <h3 className="mt-1 panel-title">Demand insight</h3>
                </div>
                <div className="rounded-xl bg-violet-500/10 p-2 text-violet-300">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="grid gap-2.5 text-sm text-[var(--text)] sm:grid-cols-2 xl:grid-cols-1">
                <div className="theme-surface-alt rounded-xl p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Historical observations</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--text-strong)]">{metrics.demand_trend.length || 0}</p>
                </div>
                <div className="theme-surface-alt rounded-xl p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Average daily demand</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--text-strong)]">
                    {metrics.demand_trend.length ? (metrics.demand_trend.reduce((total, item) => total + item.quantity, 0) / metrics.demand_trend.length).toFixed(1) : '0.0'}
                    <span className="text-xs font-normal text-[var(--text-muted)] ml-1.5">units / day</span>
                  </p>
                </div>
                <div className="theme-surface-alt rounded-xl p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">30-Day Demand Total</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--text-strong)]">
                    {metrics.demand_trend.length ? metrics.demand_trend.reduce((total, item) => total + item.quantity, 0).toLocaleString() : 0}
                    <span className="text-xs font-normal text-[var(--text-muted)] ml-1.5">units</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <Link to="/forecasting" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:text-[var(--text-strong)] transition-colors">
                <span>View AI forecasts & demand</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
