import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Search } from 'lucide-react'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { MainLayout } from '../components/layout/MainLayout'
import { getAllProducts } from '../services/productService'
import { createStockMovement, getStockMovementReceipt, getStockMovements, getStockSummary } from '../services/inventoryService'
import type { Product, StockMovement } from '../types'

type MovementForm = {
  product_id: string
  movement_type: 'Stock In' | 'Stock Out' | 'Return' | 'Adjustment' | 'Opening Stock'
  quantity: string
  movement_date: string
  reference: string
  description: string
}

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = (): MovementForm => ({
  product_id: '',
  movement_type: 'Stock In',
  quantity: '',
  movement_date: today(),
  reference: '',
  description: '',
})

const movementLabels: Record<string, string> = {
  'Stock In': 'Stock In (Receipt)',
  'Stock Out': 'Stock Out (Issue)',
  'Opening Stock': 'Opening Stock',
  Return: 'Customer Return',
  Adjustment: 'Physical Adjustment',
}

export default function StockMovementsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [summary, setSummary] = useState<any[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [form, setForm] = useState<MovementForm>(emptyForm)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const [productData, stockSummary, history] = await Promise.all([
        getAllProducts(),
        getStockSummary(),
        getStockMovements(),
      ])
      setProducts(productData)
      setSummary(stockSummary)
      setMovements(history)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load stock movements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const selectedProduct = summary.find((item) => item.id === Number(form.product_id))
  const visibleMovements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return movements.filter((movement) => {
      const matchesType = typeFilter === 'all' || movement.movement_type === typeFilter
      const searchable = `${movement.product_name || ''} ${movement.product_sku || ''} ${movement.movement_type || ''} ${movement.reference || ''} ${movement.description || ''}`.toLowerCase()
      const matchesFromDate = !fromDate || movement.movement_date >= fromDate
      const matchesToDate = !toDate || movement.movement_date <= toDate
      return matchesType && matchesFromDate && matchesToDate && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [movements, query, typeFilter, fromDate, toDate])

  const totalStock = summary.reduce((total, item) => total + Number(item.stock || 0), 0)
  const lowStock = summary.filter((item) => item.stock <= item.reorder_point).length

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSuccess('')
    setError('')
    const quantity = Number(form.quantity)
    if (!form.product_id || !Number.isInteger(quantity) || quantity <= 0) {
      setError('Select a product and enter a positive whole-number quantity.')
      return
    }

    if (form.movement_type === 'Stock Out' && selectedProduct && quantity > selectedProduct.stock) {
      setError(`Only ${selectedProduct.stock} units are available for this issue.`)
      return
    }

    try {
      setSubmitting(true)
      await createStockMovement({
        product_id: Number(form.product_id),
        movement_type: form.movement_type,
        quantity,
        movement_date: form.movement_date,
        reference: form.reference.trim() || undefined,
        description: form.description.trim() || undefined,
      })
      setForm(emptyForm())
      setSuccess('Stock movement recorded successfully.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record stock movement')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReceipt = async (id: number) => {
    try {
      const receipt = await getStockMovementReceipt(id)
      const escapeHtml = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>SupplyChain receipt ${escapeHtml(receipt.id)}</title><style>
        body{font:15px system-ui,sans-serif;color:#172033;max-width:560px;margin:40px auto;padding:0 24px}
        header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #7552d9;padding-bottom:18px}
        .mark{width:34px;height:34px;border-radius:9px;background:#7552d9;color:white;display:grid;place-items:center;font-weight:700}
        h1{font-size:22px;margin:0}.muted{color:#68738a}.row{display:flex;justify-content:space-between;border-bottom:1px solid #e4e7ee;padding:11px 0}.label{color:#68738a}.actions{margin-top:26px}
        button{background:#7552d9;color:#fff;border:0;border-radius:6px;padding:10px 16px;cursor:pointer}@media print{.actions{display:none}}
      </style></head><body>
        <header><div class="mark">SC</div><div><h1>SupplyChain</h1><div class="muted">Inventory movement receipt</div></div></header>
        <div class="row"><span class="label">Transaction ID</span><strong>#${escapeHtml(receipt.id)}</strong></div>
        <div class="row"><span class="label">Product</span><strong>${escapeHtml(receipt.product_name)} (${escapeHtml(receipt.product_sku)})</strong></div>
        <div class="row"><span class="label">Movement</span><strong>${escapeHtml(receipt.movement_type)}</strong></div>
        <div class="row"><span class="label">Quantity</span><strong>${escapeHtml(receipt.quantity)} units</strong></div>
        <div class="row"><span class="label">Transaction date</span><strong>${escapeHtml(receipt.movement_date)}</strong></div>
        <div class="row"><span class="label">Reference</span><strong>${escapeHtml(receipt.reference)}</strong></div>
        <div class="row"><span class="label">Stock before</span><strong>${escapeHtml(receipt.stock_quantities_available ? receipt.stock_before : 'Unavailable')}</strong></div>
        <div class="row"><span class="label">Stock after</span><strong>${escapeHtml(receipt.stock_quantities_available ? receipt.stock_after : 'Unavailable')}</strong></div>
        <div class="row"><span class="label">Notes</span><strong>${escapeHtml(receipt.description)}</strong></div>
        <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
      </body></html>`
      const downloadUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `supplychain-receipt-${receipt.id}.html`
      link.click()
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load receipt')
    }
  }

  return (
    <MainLayout title="Stock Movements" onRefresh={load}>
      {loading ? <LoadingSpinner /> : (
        <div className="space-y-5">
          {error && <ErrorMessage message={error} />}
          {success && <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{success}</div>}

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Units currently in stock', totalStock.toLocaleString(), 'Across all products'],
              ['Products tracked', summary.length.toString(), 'Active inventory records'],
              ['Products needing attention', lowStock.toString(), 'At or below reorder point'],
            ].map(([label, value, detail]) => (
              <div key={label} className="theme-panel p-4">
                <p className="panel-eyebrow">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-strong)]">{value}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p>
              </div>
            ))}
          </div>

          <div className="grid items-start gap-5 2xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.9fr)]">
            <form onSubmit={handleSubmit} className="theme-panel space-y-4 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"><Boxes size={19} /></div>
                <div>
                  <p className="panel-eyebrow">Inventory control</p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">Record stock movement</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Update inventory with an auditable receipt, issue, return, or adjustment.</p>
                </div>
              </div>
              <label className="block space-y-2 text-sm text-[var(--text-muted)]">
                <span>Product</span>
                <select className="theme-input" required value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })}>
                  <option value="">Select a product</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block min-w-0 space-y-2 text-sm text-[var(--text-muted)]">
                  <span>Movement type</span>
                  <select className="theme-input" value={form.movement_type} onChange={(event) => setForm({ ...form, movement_type: event.target.value as MovementForm['movement_type'] })}>
                    {Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block space-y-2 text-sm text-[var(--text-muted)]">
                  <span>Quantity</span>
                  <input className="theme-input" type="number" min="1" step="1" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block min-w-0 space-y-2 text-sm text-[var(--text-muted)]">
                  <span>Movement date</span>
                  <input className="theme-input" type="date" required value={form.movement_date} onChange={(event) => setForm({ ...form, movement_date: event.target.value })} />
                </label>
                <label className="block space-y-2 text-sm text-[var(--text-muted)]">
                  <span>Reference <span className="text-xs">(optional)</span></span>
                  <input className="theme-input" maxLength={100} placeholder="PO-1042 or shipment ref" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} />
                </label>
              </div>
              <label className="block space-y-2 text-sm text-[var(--text-muted)]">
                <span>Notes <span className="text-xs">(optional)</span></span>
                <textarea className="theme-input min-h-20 resize-y" placeholder="Add context for this transaction" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
              <button type="submit" disabled={submitting || products.length === 0} className="theme-button w-full disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Recording...' : 'Record stock movement'}
              </button>
            </form>

            <section className="theme-panel min-w-0 p-5">
              <div className="panel-toolbar items-end">
                <div className="panel-toolbar-heading">
                  <p className="panel-eyebrow">Audit trail</p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">Movement history</h2>
                </div>
                <div className="control-row">
                  <label className="control-grow relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input className="theme-input pl-9" placeholder="Search product or reference" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                  <select className="theme-input control-fixed control-w-lg" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="all">All types</option>
                    {Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input aria-label="Movements from date" type="date" className="theme-input control-fixed" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                  <input aria-label="Movements to date" type="date" className="theme-input control-fixed" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </div>
              </div>
              {visibleMovements.length ? (
                <>
                <p className="scroll-hint">Scroll sideways for all columns →</p>
                <div className="panel-scroll mt-4">
                  <table className="theme-table min-w-[840px] text-left text-sm">
                    <thead><tr><th>Product</th><th>Type</th><th>Quantity</th><th>Date</th><th>Reference / notes</th><th>Receipt</th></tr></thead>
                    <tbody>
                      {visibleMovements.map((movement) => {
                        const isOpening = movement.movement_type === 'Opening Stock'
                        const inbound = movement.movement_type === 'Stock In' || movement.movement_type === 'Return' || isOpening
                        return (
                          <tr key={movement.id}>
                            <td><div className="font-medium text-[var(--text-strong)]">{movement.product_name || 'Unknown product'}</div><div className="text-xs text-[var(--text-muted)]">{movement.product_sku || 'SKU unavailable'}</div></td>
                            <td>
                              <span className="inline-flex items-center gap-1.5">
                                {isOpening ? (
                                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20">Opening Stock</span>
                                ) : inbound ? (
                                  <><ArrowDownToLine size={14} className="text-emerald-400" /><span className="text-emerald-400">{movementLabels[movement.movement_type] || movement.movement_type}</span></>
                                ) : (
                                  <><ArrowUpFromLine size={14} className="text-amber-400" /><span className="text-amber-400">{movementLabels[movement.movement_type] || movement.movement_type}</span></>
                                )}
                              </span>
                            </td>
                            <td className="font-medium tabular-nums">
                              {isOpening ? `+${movement.quantity}` : inbound ? `+${movement.quantity}` : `-${movement.quantity}`}
                            </td>
                            <td>{movement.movement_date}</td>
                            <td><div>{movement.reference || '—'}</div><div className="max-w-52 truncate text-xs text-[var(--text-muted)]">{movement.description || '—'}</div></td>
                            <td><button type="button" onClick={() => void handleReceipt(movement.id)} className="theme-button theme-button-secondary px-3 py-2">Receipt</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              ) : (
                <div className="mt-4"><EmptyState title={movements.length ? 'No matching movements' : 'No movements recorded'} description={movements.length ? 'Try a different search or filter.' : 'Record the first stock movement to start the audit trail.'} /></div>
              )}
            </section>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
