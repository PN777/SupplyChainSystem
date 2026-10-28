import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Trash2,
  X,
} from 'lucide-react'
import { MainLayout } from '../components/layout/MainLayout'
import {
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder,
  advancePurchaseOrderStatus,
} from '../services/purchaseOrderService'
import { getSuppliers } from '../services/supplierService'
import { getAllProducts } from '../services/productService'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { EmptyState } from '../components/common/EmptyState'

/* ─── types ────────────────────────────────────────────────────────────── */
type FormState = {
  supplier_id: string
  product_id: string
  quantity: string
  order_date: string
  expected_delivery_date: string
  status: 'Draft' | 'Pending'
}

type ModalKind = 'receive' | 'cancel' | 'delete' | 'advance'
type ActiveModal = { kind: ModalKind; order: any; nextStatus?: string } | null

const NEXT_STATUS: Record<string, string> = {
  Draft: 'Pending',
  Pending: 'Approved',
  Approved: 'Shipped',
}

const STATUS_COLORS: Record<string, string> = {
  Draft:     'border-slate-500/30 bg-slate-500/10 text-slate-400',
  Pending:   'border-amber-500/30 bg-amber-500/10 text-amber-400',
  Approved:  'border-blue-500/30 bg-blue-500/10 text-blue-400',
  Shipped:   'border-sky-500/30 bg-sky-500/10 text-sky-400',
  Received:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  Cancelled: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
}

const initialForm = (): FormState => ({
  supplier_id: '',
  product_id: '',
  quantity: '',
  order_date: new Date().toISOString().slice(0, 10),
  expected_delivery_date: '',
  status: 'Pending',
})

/* ─── page ───────────────────────────────────────────────────────────────── */
export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [form, setForm] = useState<FormState>(initialForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ActiveModal>(null)

  const load = async () => {
    try {
      setLoading(true)
      const [orderData, supplierData, productData] = await Promise.all([
        getPurchaseOrders(),
        getSuppliers(),
        getAllProducts(),
      ])
      setOrders(orderData)
      setSuppliers(supplierData)
      setProducts(productData)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load purchase orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return orders
    return orders.filter((order) => {
      const itemText = (order.items || [])
        .map((i: any) => `${i.product_name || ''} ${i.product_sku || ''}`)
        .join(' ')
      return `po-${order.id} ${order.id} ${order.supplier_name || ''} ${order.status || ''} ${order.order_date || ''} ${order.expected_delivery_date || ''} ${itemText}`
        .toLowerCase()
        .includes(term)
    })
  }, [orders, search])

  /* ── form create ── */
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!form.supplier_id || !form.product_id || !form.quantity || Number(form.quantity) <= 0) {
      setError('Select a supplier, product, and a positive quantity.')
      return
    }
    try {
      setSaving(true)
      await createPurchaseOrder({
        supplier_id: Number(form.supplier_id),
        order_date: form.order_date,
        expected_delivery_date: form.expected_delivery_date || undefined,
        status: form.status,
        items: [{ product_id: Number(form.product_id), quantity: Number(form.quantity) }],
      })
      setForm(initialForm())
      setError('')
      setSuccess('Purchase order created successfully.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create purchase order')
    } finally {
      setSaving(false)
    }
  }

  /* ── modal actions ── */
  const closeModal = () => setModal(null)

  const executeReceive = async (order: any) => {
    closeModal()
    try {
      await receivePurchaseOrder(order.id)
      setSuccess(`PO-${order.id} received — stock updated.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to receive purchase order')
    }
  }

  const executeCancel = async (order: any) => {
    closeModal()
    try {
      await cancelPurchaseOrder(order.id)
      setSuccess(`PO-${order.id} cancelled.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel purchase order')
    }
  }

  const executeDelete = async (order: any) => {
    closeModal()
    try {
      await deletePurchaseOrder(order.id)
      setSuccess(`PO-${order.id} permanently deleted.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete purchase order')
    }
  }

  const executeAdvance = async (order: any, nextStatus: string) => {
    closeModal()
    try {
      await advancePurchaseOrderStatus(order.id, nextStatus)
      setSuccess(`PO-${order.id} advanced to ${nextStatus}.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to advance purchase order')
    }
  }

  /* ── per-row action buttons ── */
  const renderActions = (order: any) => {
    const { status } = order
    const next = NEXT_STATUS[status]
    const canDelete = ['Draft', 'Pending', 'Cancelled'].includes(status)
    const canCancel = !['Received', 'Cancelled'].includes(status)
    const canReceive = ['Pending', 'Approved', 'Shipped'].includes(status)

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Advance status */}
        {next && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'advance', order, nextStatus: next })}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20"
          >
            <ArrowRight size={12} />
            {next}
          </button>
        )}

        {/* Receive */}
        {canReceive && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'receive', order })}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20"
          >
            <CheckCircle2 size={12} />
            Receive
          </button>
        )}

        {/* Cancel */}
        {canCancel && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'cancel', order })}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
          >
            <X size={12} />
            Cancel
          </button>
        )}

        {/* Delete */}
        {canDelete && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'delete', order })}
            className="rounded-lg border border-rose-500/20 bg-rose-500/8 p-1 text-rose-400/70 transition hover:bg-rose-500/20 hover:text-rose-400"
            title="Delete order"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    )
  }

  return (
    <MainLayout title="Purchase Orders" onRefresh={load}>
      {loading ? (
        <LoadingSpinner />
      ) : error && orders.length === 0 ? (
        <ErrorMessage message={error} />
      ) : (
        <div className="space-y-5">
          {/* Inline error / success banners */}
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 size={15} className="shrink-0" />
              {success}
            </div>
          )}

          {/* ── Create form ── */}
          <section className="theme-panel p-5">
            <div className="mb-4">
              <p className="panel-eyebrow">New order</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                Create purchase order
              </h2>
            </div>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="min-w-0 space-y-1.5 text-sm text-[var(--text-muted)] xl:col-span-2">
                <span>Supplier</span>
                <select
                  required
                  className="theme-input"
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-0 space-y-1.5 text-sm text-[var(--text-muted)] xl:col-span-2">
                <span>Product</span>
                <select
                  required
                  className="theme-input"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-0 space-y-1.5 text-sm text-[var(--text-muted)]">
                <span>Quantity</span>
                <input
                  required
                  min="1"
                  step="1"
                  type="number"
                  className="theme-input"
                  placeholder="e.g. 50"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </label>

              <label className="min-w-0 space-y-1.5 text-sm text-[var(--text-muted)]">
                <span>Order date</span>
                <input
                  required
                  type="date"
                  className="theme-input"
                  value={form.order_date}
                  onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                />
              </label>

              <label className="min-w-0 space-y-1.5 text-sm text-[var(--text-muted)]">
                <span>Expected delivery <span className="text-[var(--text-muted)] font-normal">(optional)</span></span>
                <input
                  type="date"
                  className="theme-input"
                  value={form.expected_delivery_date}
                  onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
                />
              </label>

              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1 space-y-1.5 text-sm text-[var(--text-muted)]">
                  <span>Status</span>
                  <select
                    className="theme-input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Draft">Draft</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="theme-button shrink-0 whitespace-nowrap disabled:opacity-60"
                >
                  {saving ? 'Creating…' : 'Create PO'}
                </button>
              </div>
            </form>
          </section>

          {/* ── Orders table ── */}
          <section className="theme-panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="panel-eyebrow">All orders</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                  Purchase order list
                </h2>
              </div>
              <input
                aria-label="Search purchase orders"
                className="theme-input w-full sm:max-w-xs"
                placeholder="Search PO, supplier, product, status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {visibleOrders.length ? (
              <>
                <p className="scroll-hint">Scroll sideways for all columns →</p>
                <div className="panel-scroll">
                  <table className="theme-table min-w-[900px] text-left text-sm">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Supplier</th>
                        <th>Items</th>
                        <th>Expected</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <span className="flex items-center gap-1.5 font-medium text-[var(--text-strong)]">
                              <ClipboardList size={14} className="shrink-0 text-[var(--primary)]" />
                              PO-{order.id}
                            </span>
                            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                              {order.order_date}
                            </div>
                          </td>
                          <td>{order.supplier_name || '—'}</td>
                          <td className="max-w-[220px] truncate">
                            {(order.items || [])
                              .map((i: any) => `${i.product_name} × ${i.quantity}`)
                              .join(', ') || '—'}
                          </td>
                          <td>{order.expected_delivery_date || '—'}</td>
                          <td>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.status] ?? 'border-[var(--border)] text-[var(--text-muted)]'}`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td>{renderActions(order)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState
                title={search.trim() ? 'No orders match your search' : 'No purchase orders yet'}
                description={
                  search.trim()
                    ? 'Try a different order number, supplier, product, or status.'
                    : 'Create a purchase order above to start tracking procurement.'
                }
              />
            )}
          </section>
        </div>
      )}

      {/* ── Modals ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">

            {/* Advance */}
            {modal.kind === 'advance' && (
              <>
                <h4 className="text-base font-semibold text-[var(--text-strong)]">
                  Advance to {modal.nextStatus}
                </h4>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Move PO-{modal.order.id} from <strong>{modal.order.status}</strong> →{' '}
                  <strong>{modal.nextStatus}</strong>?
                </p>
                <div className="mt-5 flex justify-end gap-2.5">
                  <button type="button" onClick={closeModal} className="theme-button theme-button-secondary px-3.5 py-2 text-sm">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void executeAdvance(modal.order, modal.nextStatus!)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                  >
                    <ArrowRight size={15} />
                    Confirm
                  </button>
                </div>
              </>
            )}

            {/* Receive */}
            {modal.kind === 'receive' && (
              <>
                <h4 className="text-base font-semibold text-[var(--text-strong)]">
                  Receive Purchase Order
                </h4>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Mark PO-{modal.order.id} as received and automatically increment inventory for
                  all line items?
                </p>
                <div className="mt-5 flex justify-end gap-2.5">
                  <button type="button" onClick={closeModal} className="theme-button theme-button-secondary px-3.5 py-2 text-sm">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void executeReceive(modal.order)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <CheckCircle2 size={15} />
                    Confirm Receipt
                  </button>
                </div>
              </>
            )}

            {/* Cancel */}
            {modal.kind === 'cancel' && (
              <>
                <h4 className="text-base font-semibold text-[var(--text-strong)]">
                  Cancel Purchase Order
                </h4>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Cancel PO-{modal.order.id}? This action cannot be undone. The order will remain
                  visible with a Cancelled status.
                </p>
                <div className="mt-5 flex justify-end gap-2.5">
                  <button type="button" onClick={closeModal} className="theme-button theme-button-secondary px-3.5 py-2 text-sm">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void executeCancel(modal.order)}
                    className="theme-button theme-button-danger px-4 py-2 text-sm font-semibold"
                  >
                    Cancel Order
                  </button>
                </div>
              </>
            )}

            {/* Delete */}
            {modal.kind === 'delete' && (
              <>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-rose-400 shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[var(--text-strong)]">
                      Delete Purchase Order
                    </h4>
                    <p className="mt-0.5 text-sm font-medium text-[var(--text-strong)]">
                      PO-{modal.order.id}
                      {modal.order.supplier_name ? ` — ${modal.order.supplier_name}` : ''}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                      This permanently removes the order and all its line items. Only Draft,
                      Pending, or Cancelled orders can be deleted. Received orders must stay to
                      preserve the inventory audit trail.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                  <button type="button" onClick={closeModal} className="theme-button theme-button-secondary px-3.5 py-2 text-sm">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void executeDelete(modal.order)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                  >
                    <Trash2 size={14} />
                    Permanently Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  )
}
