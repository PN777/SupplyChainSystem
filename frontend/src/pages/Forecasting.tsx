import { useEffect, useMemo, useState } from 'react'
import { MainLayout } from '../components/layout/MainLayout'
import { getAllProducts } from '../services/productService'
import {
  getForecast,
  getDemandHistory,
  createDemandEntry,
  updateDemandEntry,
  deleteDemandEntry,
  importDemandCsv,
} from '../services/forecastingService'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { Product } from '../types'

type DemandFormState = {
  product_id: number | ''
  demand_date: string
  quantity: string
}

const emptyForm = (): DemandFormState => ({
  product_id: '',
  demand_date: new Date().toISOString().slice(0, 10),
  quantity: '',
})

export default function ForecastingPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [forecast, setForecast] = useState<any>(null)
  const [demand, setDemand] = useState<any[]>([])
  const [form, setForm] = useState<DemandFormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleteDemandId, setDeleteDemandId] = useState<number | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const productList = await getAllProducts()
      setProducts(productList)
      if (productList.length) {
        const nextId =
          selectedId && productList.some((product) => product.id === selectedId)
            ? selectedId
            : productList[0].id
        setSelectedId(nextId)
        setForm((current) => ({ ...current, product_id: nextId }))
        const [forecastResult, demandResult] = await Promise.all([
          getForecast(nextId),
          getDemandHistory(nextId),
        ])
        setForecast(forecastResult)
        setDemand(demandResult)
      } else {
        setSelectedId(null)
        setForecast(null)
        setDemand([])
      }
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load forecasting data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleProductChange = async (id: number) => {
    setSelectedId(id)
    setForm((current) => ({ ...current, product_id: id }))
    try {
      const [forecastResult, demandResult] = await Promise.all([
        getForecast(id),
        getDemandHistory(id),
      ])
      setForecast(forecastResult)
      setDemand(demandResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load forecast')
    }
  }

  const filteredDemand = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return demand
    return demand.filter((entry) => {
      const product = products.find((item) => item.id === entry.product_id)
      const searchable = `${product?.name || ''} ${product?.sku || ''} ${entry.demand_date || ''} ${entry.quantity || ''}`.toLowerCase()
      return searchable.includes(normalized)
    })
  }, [demand, products, search])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (!form.product_id || !form.demand_date || form.quantity === '') {
      setError('Select a product, date, and quantity before saving.')
      return
    }
    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || !Number.isFinite(quantity) || quantity <= 0) {
      setError('Quantity must be a positive whole number.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')
      const payload = {
        product_id: Number(form.product_id),
        demand_date: form.demand_date,
        quantity,
      }
      const productId = Number(form.product_id)
      if (editingId !== null) {
        await updateDemandEntry(editingId, payload)
      } else {
        await createDemandEntry(payload)
      }
      setForm((current) => ({ ...current, quantity: '' }))
      setEditingId(null)
      setSelectedId(productId)
      const [forecastResult, demandResult] = await Promise.all([
        getForecast(productId),
        getDemandHistory(productId),
      ])
      setForecast(forecastResult)
      setDemand(demandResult)
      setSuccess(
        editingId !== null
          ? 'Demand record updated successfully.'
          : 'Demand record added successfully.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save demand record')
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (entry: any) => {
    setEditingId(entry.id)
    setForm({
      product_id: entry.product_id,
      demand_date: entry.demand_date,
      quantity: String(entry.quantity),
    })
    setSelectedId(entry.product_id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (id: number) => {
    setDeleteDemandId(id)
  }

  const executeDeleteDemand = async (id: number) => {
    try {
      setDeleteDemandId(null)
      await deleteDemandEntry(id)
      if (selectedId) {
        const [forecastResult, demandResult] = await Promise.all([
          getForecast(selectedId),
          getDemandHistory(selectedId),
        ])
        setForecast(forecastResult)
        setDemand(demandResult)
      }
      setSuccess('Demand record deleted successfully.')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete demand record')
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setImporting(true)
      const result = await importDemandCsv(file)
      setError('')
      setSuccess(`${result.imported} demand record${result.imported === 1 ? '' : 's'} imported.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import demand CSV')
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedId)

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!forecast) return []
    const hist = (forecast.historical_points || []).map((pt: any) => ({
      date: pt.date,
      historical: pt.quantity,
      forecast: null,
    }))
    const fore = (forecast.forecast_dates || []).map((date: string, idx: number) => ({
      date,
      historical: null,
      forecast: forecast.forecast[idx],
    }))
    return [...hist, ...fore]
  }, [forecast])

  return (
    <MainLayout title="Demand Forecasting & History" onRefresh={load}>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <div className="space-y-6">
          {success && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              <span>{success}</span>
              <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-200">✕</button>
            </div>
          )}

          {/* Product Selector Bar */}
          <div className="theme-panel flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <span className="whitespace-nowrap text-sm font-semibold text-[var(--text-strong)]">
                Select Product:
              </span>
              <select
                value={selectedId ?? ''}
                onChange={(e) => handleProductChange(Number(e.target.value))}
                className="theme-input w-full sm:w-80"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) {p.is_active === false ? '[Archived]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1">Lead Time: <strong className="text-[var(--text-strong)]">{selectedProduct?.lead_time_days ?? '—'} days</strong></span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1">Safety Stock: <strong className="text-[var(--text-strong)]">{selectedProduct?.safety_stock ?? '—'} units</strong></span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1">Current Stock: <strong className="text-[var(--text-strong)]">{selectedProduct?.current_stock ?? '—'}</strong></span>
            </div>
          </div>

          {/* Demand Record Entry Form */}
          <div className="theme-panel p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-strong)]">
                  {editingId !== null ? 'Edit Demand Record' : 'Log Daily Demand'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Record actual customer or operational demand for consumption tracking.
                </p>
              </div>
              <label className="theme-button theme-button-secondary cursor-pointer text-xs py-1.5 px-3">
                {importing ? 'Importing CSV...' : 'Import CSV'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  disabled={importing}
                  onChange={handleImport}
                />
              </label>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <label className="space-y-1.5 text-xs text-[var(--text-muted)] sm:col-span-1">
                <span>Product *</span>
                <select
                  required
                  className="theme-input w-full text-sm"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: Number(e.target.value) })}
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-xs text-[var(--text-muted)] sm:col-span-1">
                <span>Demand Date *</span>
                <input
                  required
                  type="date"
                  className="theme-input w-full text-sm"
                  value={form.demand_date}
                  onChange={(e) => setForm({ ...form, demand_date: e.target.value })}
                />
              </label>

              <label className="space-y-1.5 text-xs text-[var(--text-muted)] sm:col-span-1">
                <span>Quantity (Units) *</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 25"
                  className="theme-input w-full text-sm"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </label>

              <div className="flex gap-2 sm:col-span-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="theme-button w-full text-sm py-2 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingId !== null ? 'Update Record' : 'Save Record'}
                </button>
                {editingId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setForm(emptyForm())
                    }}
                    className="theme-button theme-button-secondary text-xs px-3"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Forecasting Model & Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="theme-panel p-4">
              <span className="text-xs font-medium text-[var(--text-muted)]">Observations</span>
              <div className="mt-1 text-2xl font-bold text-[var(--text-strong)]">
                {forecast?.observations ?? 0}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {forecast?.period_start ? `${forecast.period_start} to ${forecast.period_end}` : 'No history span'}
              </div>
            </div>

            <div className="theme-panel p-4">
              <span className="text-xs font-medium text-[var(--text-muted)]">Mean Daily Demand</span>
              <div className="mt-1 text-2xl font-bold text-[var(--accent-light)]">
                {forecast?.historical_average ? `${forecast.historical_average} units` : '—'}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">Average daily consumption</div>
            </div>

            <div className="theme-panel p-4">
              <span className="text-xs font-medium text-[var(--text-muted)]">Backtest MAE / WAPE</span>
              <div className="mt-1 text-2xl font-bold text-amber-300">
                {forecast?.mae !== null && forecast?.mae !== undefined ? `${forecast.mae} (${forecast.wape}%)` : 'Insufficient data'}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                Baseline MAE: {forecast?.baseline_mae ?? '—'}
              </div>
            </div>

            <div className="theme-panel p-4">
              <span className="text-xs font-medium text-[var(--text-muted)]">Reorder Point Estimate</span>
              <div className="mt-1 text-2xl font-bold text-emerald-400">
                {forecast?.reorder_estimate !== null && forecast?.reorder_estimate !== undefined
                  ? `${forecast.reorder_estimate} units`
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                Avg × Lead ({selectedProduct?.lead_time_days || 0}d) + Safety ({selectedProduct?.safety_stock || 0})
              </div>
            </div>
          </div>

          {/* Time Series Chart */}
          <div className="theme-panel p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border)] mb-4 gap-2">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-strong)]">
                  Demand History vs. 7-Day Forecast Horizon
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {forecast?.algorithm || 'Time Series Method'} • {forecast?.explanation || 'Insufficient data.'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#8b7cf6]" />
                  <span className="text-[var(--text-muted)]">Historical Demand</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-[#34d399]" />
                  <span className="text-emerald-400">Projected Estimate</span>
                </div>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      angle={-25}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      unit=" u"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-strong)',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="historical"
                      name="Historical"
                      stroke="#8b7cf6"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast Estimate"
                      stroke="#34d399"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[var(--text-muted)]">
                No observations available for this product. Add demand records above to generate a projection.
              </div>
            )}

            <div className="mt-3 rounded border border-[var(--border)] bg-[var(--surface-muted)]/30 p-2.5 text-xs text-[var(--text-muted)]">
              <strong>Methodology & Limitations:</strong> {forecast?.limitations || 'Statistical estimates are non-binding operational guidance. Real demand may vary due to seasonality, promotions, and market supply.'}
            </div>
          </div>

          {/* Historical Demand Table */}
          <div className="theme-panel p-5">
            <div className="panel-toolbar mb-4 border-b border-[var(--border)] pb-3">
              <div className="panel-toolbar-heading">
                <h3 className="text-base font-semibold text-[var(--text-strong)]">
                  Persisted Demand Records
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Audit log of demand entries for {selectedProduct?.name || 'product'}
                </p>
              </div>
              <input
                className="theme-input field-lg text-xs"
                placeholder="Search date or qty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {filteredDemand.length ? (
              <>
              <p className="scroll-hint">Scroll sideways for all columns →</p>
              <div className="panel-scroll">
                <table className="theme-table min-w-[600px] text-left text-sm">
                  <thead>
                    <tr>
                      <th>Record ID</th>
                      <th>Demand Date</th>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDemand.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[var(--surface-muted)]/40 transition-colors">
                        <td className="font-mono text-xs text-[var(--text-muted)]">#{entry.id}</td>
                        <td className="font-medium text-[var(--text-strong)]">{entry.demand_date}</td>
                        <td>{entry.product_name || `Product #${entry.product_id}`}</td>
                        <td className="font-semibold text-[var(--text-strong)]">{entry.quantity} units</td>
                        <td className="text-right">
                          <button
                            onClick={() => startEditing(entry)}
                            className="text-xs text-blue-400 hover:underline mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-xs text-rose-400 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-[var(--text-muted)]">
                No demand records found for this product.
              </div>
            )}
          </div>

          {/* Delete Demand Confirmation Modal */}
          {deleteDemandId !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
                <h4 className="text-base font-semibold text-[var(--text-strong)]">Delete Demand Record</h4>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Are you sure you want to delete demand record #{deleteDemandId}?
                </p>
                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeleteDemandId(null)}
                    className="theme-button theme-button-secondary px-3.5 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void executeDeleteDemand(deleteDemandId)}
                    className="theme-button theme-button-danger px-3.5 py-1.5 text-xs"
                  >
                    Delete Record
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  )
}
