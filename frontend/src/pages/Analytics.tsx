import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { MainLayout } from '../components/layout/MainLayout'
import {
  getDashboardAnalytics,
  getDemandAnalytics,
  getInventoryAnalytics,
  getSuppliersAnalytics,
} from '../services/analyticsService'
import { getProducts } from '../services/productService'

/* ─── formatters ─────────────────────────────────────────────────────────── */
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-strong)',
  fontSize: 13,
}

/* ─── sub-components ────────────────────────────────────────────────────── */
function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center">
      <EmptyState title="Insufficient data" description={message} />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-panel p-4">
      <p className="panel-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-strong)]">{value}</p>
    </div>
  )
}

/* ─── page ───────────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<any>({})
  const [inventory, setInventory] = useState<any[]>([])
  const [supplierData, setSupplierData] = useState<any[]>([])
  const [demand, setDemand] = useState<any[]>([])
  const [totalDemand, setTotalDemand] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Refs keep the latest filter values available inside `load` without causing
  // stale closures when the product picker triggers an immediate reload.
  const startRef = useRef(startDate)
  const endRef = useRef(endDate)
  useEffect(() => { startRef.current = startDate }, [startDate])
  useEffect(() => { endRef.current = endDate }, [endDate])

  const load = useCallback(async (productId = selectedProduct) => {
    try {
      setLoading(true)
      const [dashboard, inventoryData, demandData, supplierSummary, productData] = await Promise.all([
        getDashboardAnalytics(),
        getInventoryAnalytics(),
        getDemandAnalytics(
          productId ? Number(productId) : undefined,
          startRef.current,
          endRef.current,
        ),
        getSuppliersAnalytics(),
        getProducts(),
      ])

      setMetrics(dashboard)
      // Backend already filters and sorts by stock_value > 0
      setInventory(inventoryData.chart || [])
      setDemand(demandData.chart || [])
      setTotalDemand(Number(demandData.total_demand ?? dashboard.total_demand ?? 0))
      setSupplierData(supplierSummary)
      setProducts(productData.items || [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics')
    } finally {
      setLoading(false)
    }
  }, [selectedProduct])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Only show suppliers that have at least one evaluated delivery */
  const supplierChart = useMemo(
    () => supplierData.filter((s) => s.delivered_orders > 0 && s.on_time_delivery !== null),
    [supplierData],
  )

  const summaryCards: [string, string][] = [
    ['Inventory value', currency.format(metrics.total_inventory_value ?? 0)],
    ['Low-stock products', String(metrics.low_stock_products ?? 0)],
    ['Stockout products', String(metrics.out_of_stock_products ?? 0)],
    ['Total demand', `${totalDemand.toLocaleString()} units`],
  ]

  return (
    <MainLayout title="Analytics & Reports" onRefresh={() => void load()}>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <div className="space-y-5">
          {/* ── Summary KPIs ── */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(([label, value]) => (
              <SummaryCard key={label} label={label} value={value} />
            ))}
          </div>

          {/* ── Top charts row ── */}
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Inventory valuation */}
            <section className="theme-panel flex min-w-0 flex-col p-5">
              {/* Fixed-height header so chart tops align with the right panel */}
              <div className="mb-4 flex min-h-[7.5rem] flex-col justify-between">
                <div>
                  <p className="panel-eyebrow">Inventory valuation</p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                    Stock value by product
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Current stock × unit cost, shown in USD (\$).
                  </p>
                </div>
                {/* spacer — keeps the chart top aligned with the right panel's Apply row */}
                <div className="h-9" />
              </div>

              {inventory.length ? (
                <div className="h-72 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={inventory}
                      layout="vertical"
                      margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
                    >
                      <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => currency.format(v)}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="product"
                        width={116}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(v) => [currency.format(Number(v)), 'Stock value']}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: 'var(--text-strong)', fontWeight: 600 }}
                        cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
                      />
                      <Bar
                        dataKey="stock_value"
                        name="Stock value"
                        fill="var(--primary)"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={36}
                        isAnimationActive
                        animationBegin={60}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty message="Add products and stock movements to calculate inventory value." />
              )}
            </section>

            {/* Daily demand trend */}
            <section className="theme-panel flex min-w-0 flex-col p-5">
              {/* Header + filters — fixed min-height matches left panel's header block */}
              <div className="mb-4 min-h-[7.5rem]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="panel-eyebrow">Historical demand</p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                      Daily demand trend
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Aggregated persisted demand, measured in units.
                    </p>
                  </div>
                  <select
                    className="theme-input w-auto min-w-[9rem] shrink-0 text-sm"
                    value={selectedProduct}
                    onChange={(e) => {
                      setSelectedProduct(e.target.value)
                      void load(e.target.value)
                    }}
                  >
                    <option value="">All products</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {/* Date range row — this is the extra height vs the left panel; the left panel has a matching spacer div */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Demand start date"
                    type="date"
                    className="theme-input min-w-0 flex-1 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <input
                    aria-label="Demand end date"
                    type="date"
                    className="theme-input min-w-0 flex-1 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <button
                    type="button"
                    className="theme-button theme-button-secondary shrink-0 px-4 py-2 text-sm"
                    onClick={() => void load()}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {demand.length ? (
                <div className="h-72 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={demand}
                      margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
                    >
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        unit=" units"
                        width={72}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v).toLocaleString()} units`, 'Demand']}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: 'var(--text-strong)', fontWeight: 600 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="quantity"
                        name="Demand"
                        stroke="var(--primary)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 0 }}
                        isAnimationActive
                        animationBegin={60}
                        animationDuration={900}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty message="Add at least one demand record to plot the historical trend." />
              )}
            </section>
          </div>

          {/* ── Supplier performance ── */}
          <section className="theme-panel min-w-0 p-5">
            <div className="mb-5">
              <p className="panel-eyebrow">Supplier performance</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                On-time delivery rate
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Derived from eligible purchase orders with known expected and actual delivery dates
                (actual &le; expected). Green bars indicate ≥ 90 % on-time rate.
              </p>
            </div>

            {supplierChart.length ? (
              <>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={supplierChart}
                      margin={{ top: 8, right: 20, bottom: 4, left: 4 }}
                      barCategoryGap="32%"
                    >
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis
                        dataKey="supplier_name"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        unit="%"
                        width={52}
                      />
                      <Tooltip
                        formatter={(_v: any, _n: any, item: any) => {
                          const p = item.payload
                          const detail = p.delivered_orders
                            ? ` (${p.on_time_orders ?? 0} of ${p.delivered_orders} on time)`
                            : ''
                          return [`${Number(item.value).toFixed(1)}%${detail}`, 'On-time delivery']
                        }}
                        contentStyle={tooltipStyle}
                        cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
                      />
                      <Bar
                        dataKey="on_time_delivery"
                        name="On-time delivery"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={72}
                        isAnimationActive
                        animationBegin={60}
                        animationDuration={900}
                        animationEasing="ease-out"
                      >
                        {supplierChart.map((s) => (
                          <Cell
                            key={s.supplier_name}
                            fill={s.on_time_delivery >= 90 ? '#34d399' : '#a78bfa'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#34d399]" />
                    ≥ 90 % on-time
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#a78bfa]" />
                    &lt; 90 % on-time
                  </span>
                </div>
                <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                  Sample size verified per supplier — cancelled orders and those missing receipt
                  dates are excluded.
                </p>
              </>
            ) : (
              <ChartEmpty message="Supplier delivery performance requires at least one delivered order with an expected delivery date." />
            )}
          </section>
        </div>
      )}
    </MainLayout>
  )
}
