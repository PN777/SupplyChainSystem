import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Boxes,
  CheckCircle2,
  Edit3,
  Layers,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { EmptyState } from '../components/common/EmptyState'
import { MainLayout } from '../components/layout/MainLayout'
import { createStockMovement, getStockSummary, getStockMovements } from '../services/inventoryService'
import { archiveProduct, reactivateProduct, deleteProduct, getAllProducts } from '../services/productService'
import type { Product } from '../types'

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)

  // Modal / Editor state
  // editorMode: 'opening' | 'adjust'
  const [editorMode, setEditorMode] = useState<'opening' | 'adjust' | null>(null)
  const [targetProduct, setTargetProduct] = useState<any | null>(null)
  const [stockForm, setStockForm] = useState({
    product_id: '',
    quantity: '',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [archiveModal, setArchiveModal] = useState<{ id: number; name: string } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string; sku: string } | null>(null)
  const [confirmArchiveModal, setConfirmArchiveModal] = useState<{ id: number; name: string } | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const [summary, history, productData] = await Promise.all([
        getStockSummary({ include_archived: includeArchived ? 'true' : 'false' }),
        getStockMovements(),
        getAllProducts({ include_archived: 'true' }),
      ])
      setItems(summary)
      setMovements(history)
      setProducts(productData)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [includeArchived])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      const stock = Number(item.stock || 0)
      const reorder = Number(item.reorder_point || 0)
      const maxStock = Number(item.max_stock || 0)

      const matchesStock =
        !statusFilter ||
        (statusFilter === 'out' && stock <= 0) ||
        (statusFilter === 'low' && stock > 0 && stock <= reorder) ||
        (statusFilter === 'excess' && maxStock > 0 && stock > maxStock) ||
        (statusFilter === 'healthy' && stock > reorder && (maxStock === 0 || stock <= maxStock))

      const text = `${item.name || ''} ${item.sku || ''} ${item.category || ''}`.toLowerCase()
      return (!term || text.includes(term)) && matchesStock
    })
  }, [items, search, statusFilter])

  const openOpeningStockModal = (product?: Product) => {
    setEditorMode('opening')
    setTargetProduct(product || null)
    setStockForm({
      product_id: product ? String(product.id) : '',
      quantity: '',
      reason: 'Initial opening stock',
    })
    setError('')
    setSuccess('')
  }

  const openAdjustStockModal = (item: any) => {
    setEditorMode('adjust')
    setTargetProduct(item)
    setStockForm({
      product_id: String(item.id),
      quantity: String(item.stock),
      reason: '',
    })
    setError('')
    setSuccess('')
  }

  const closeEditor = () => {
    setEditorMode(null)
    setTargetProduct(null)
    setStockForm({ product_id: '', quantity: '', reason: '' })
  }

  const handleStockSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    const productId = Number(stockForm.product_id)
    if (!productId) {
      setError('Please select a product.')
      return
    }

    const currentItem = items.find((i) => i.id === productId)
    const currentStock = currentItem ? Number(currentItem.stock) : 0

    if (editorMode === 'opening') {
      const qty = Number(stockForm.quantity)
      if (!Number.isInteger(qty) || qty <= 0) {
        setError('Opening stock quantity must be a positive whole number.')
        return
      }

      try {
        setSubmitting(true)
        setError('')
        await createStockMovement({
          product_id: productId,
          movement_type: 'Opening Stock',
          quantity: qty,
          movement_date: new Date().toISOString().slice(0, 10),
          reference: 'opening-stock',
          description: stockForm.reason.trim() || 'Recorded opening stock balance',
        })
        setSuccess(`Opening stock of ${qty} units recorded successfully.`)
        closeEditor()
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to record opening stock.')
      } finally {
        setSubmitting(false)
      }
    } else if (editorMode === 'adjust') {
      const targetQuantity = Number(stockForm.quantity)
      if (!Number.isInteger(targetQuantity) || targetQuantity < 0) {
        setError('Stock quantity cannot be negative.')
        return
      }

      const delta = targetQuantity - currentStock
      if (delta === 0) {
        setError(`Stock is already at ${currentStock} units. Enter a different quantity.`)
        return
      }

      try {
        setSubmitting(true)
        setError('')
        await createStockMovement({
          product_id: productId,
          movement_type: 'Adjustment',
          quantity: delta,
          movement_date: new Date().toISOString().slice(0, 10),
          reference: 'audit-adjustment',
          description:
            stockForm.reason.trim() ||
            `Inventory adjusted from ${currentStock} to ${targetQuantity} units (${delta > 0 ? '+' : ''}${delta})`,
        })
        setSuccess(`Stock adjusted from ${currentStock} to ${targetQuantity} units.`)
        closeEditor()
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to adjust inventory.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleArchive = async (id: number) => {
    try {
      await archiveProduct(id)
      setArchiveModal(null)
      setConfirmArchiveModal(null)
      setSuccess('Product archived. Historical inventory and movements remain intact.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive product.')
    }
  }

  const handleReactivate = async (id: number) => {
    try {
      await reactivateProduct(id)
      setSuccess('Product reactivated.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reactivate product.')
    }
  }

  const handleDelete = (item: any) => {
    setDeleteModal({ id: item.id, name: item.name, sku: item.sku })
  }

  const executeDelete = async (item: { id: number; name: string; sku: string }) => {
    try {
      await deleteProduct(item.id)
      setDeleteModal(null)
      setSuccess(`Product "${item.name}" deleted.`)
      await load()
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Unable to delete product'
      setDeleteModal(null)
      setError(msg)
      setArchiveModal({ id: item.id, name: item.name })
    }
  }

  return (
    <MainLayout title="Inventory" onRefresh={load}>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-6">
          {error && <ErrorMessage message={error} />}
          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-400 border border-rose-500/20 shrink-0">
                    <Trash2 size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[var(--text-strong)]">Delete Product</h4>
                    <p className="mt-1 text-sm font-medium text-[var(--text-strong)]">
                      "{deleteModal.name}" <span className="font-mono text-xs text-[var(--text-muted)]">({deleteModal.sku})</span>
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      Products with historical stock movements or purchase orders cannot be permanently deleted. You can safely archive them instead to retain audit records.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModal(null)}
                    className="theme-button theme-button-secondary px-3.5 py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const item = deleteModal
                      setDeleteModal(null)
                      void handleArchive(item.id)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/20 px-3.5 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-600/30"
                  >
                    <Archive size={14} />
                    Archive Instead
                  </button>
                  <button
                    type="button"
                    onClick={() => void executeDelete(deleteModal)}
                    className="theme-button theme-button-danger px-3.5 py-2 text-xs font-semibold"
                  >
                    Permanently Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Archive Confirmation Modal */}
          {confirmArchiveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-300 border border-violet-500/20 shrink-0">
                    <Archive size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[var(--text-strong)]">Archive Product</h4>
                    <p className="mt-1 text-sm font-medium text-[var(--text-strong)]">
                      "{confirmArchiveModal.name}"
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      Archiving deactivates this product from new purchase orders and inventory selectors while preserving all historical movements, valuation, and analytics.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmArchiveModal(null)}
                    className="theme-button theme-button-secondary px-3.5 py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleArchive(confirmArchiveModal.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-violet-500"
                  >
                    <Archive size={14} />
                    Confirm Archive
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Archive Alternative Dialog Modal */}
          {archiveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400 shrink-0">
                    <AlertCircle size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[var(--text-strong)]">Archive recommended</h4>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      "{archiveModal.name}" has recorded inventory movements or orders. Archive this product instead to
                      preserve audit history without breaking relationships.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setArchiveModal(null)}
                    className="theme-button theme-button-secondary px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleArchive(archiveModal.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-violet-500"
                  >
                    <Archive size={15} />
                    Archive product
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Overview and Controls */}
          <div className="theme-panel p-5">
            <div className="panel-toolbar">
              <div className="panel-toolbar-heading">
                <p className="panel-eyebrow">Real-time stock balance</p>
                <h3 className="panel-title">Stock overview & adjustments</h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Derived from persisted movements: Stock In, Issues, Returns, Opening Balances, and Adjustments.
                </p>
              </div>

              <div className="panel-toolbar-actions">
                <a
                  href="/products"
                  className="theme-button theme-button-secondary inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-sm"
                >
                  <Plus size={15} />
                  <span>Add Product</span>
                </a>
                <button
                  type="button"
                  onClick={() => openOpeningStockModal()}
                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500"
                >
                  <Layers size={15} />
                  <span>Add opening stock</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--border)] pt-4">
              <div className="control-row flex-1">
                <div className="control-grow relative max-w-sm">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    className="theme-input pl-9"
                    placeholder="Search name, SKU..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <select
                  className="theme-input control-fixed control-w-lg"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="healthy">Healthy</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                  <option value="excess">Excess stock</option>
                </select>
              </div>

              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="rounded border-[var(--border)] bg-[var(--surface-alt)]"
                />
                <span>Include archived products</span>
              </label>
            </div>

            {/* Stock Editor Modal / Slide-out */}
            {editorMode !== null && (
              <form
                onSubmit={handleStockSubmit}
                className="mt-4 grid gap-3.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-alt)] p-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <Boxes size={18} className="text-[var(--primary)]" />
                    <h4 className="text-sm font-semibold text-[var(--text-strong)]">
                      {editorMode === 'opening' ? 'Record opening stock' : `Adjust stock balance: ${targetProduct?.name || ''}`}
                    </h4>
                  </div>
                  <button type="button" onClick={closeEditor} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                    Cancel
                  </button>
                </div>

                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)] sm:col-span-2">
                  <span className="text-[var(--text)]">Product</span>
                  <select
                    className="theme-input"
                    value={stockForm.product_id}
                    disabled={targetProduct !== null}
                    onChange={(e) => setStockForm({ ...stockForm, product_id: e.target.value })}
                  >
                    <option value="">Select product</option>
                    {products
                      .filter((p) => p.is_active !== false || p.id === Number(stockForm.product_id))
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku}) {product.is_active === false ? '(Archived)' : ''}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">
                    {editorMode === 'opening' ? 'Opening quantity' : 'New total quantity on hand'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    className="theme-input"
                    placeholder="e.g. 50"
                    value={stockForm.quantity}
                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  />
                  {editorMode === 'adjust' && targetProduct && (
                    <span className="block text-[11px] text-[var(--text-muted)]">
                      Current balance: {targetProduct.stock} units
                    </span>
                  )}
                </label>

                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Audit reason</span>
                  <input
                    className="theme-input"
                    placeholder="e.g. Annual physical count verification"
                    value={stockForm.reason}
                    onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })}
                  />
                </label>

                <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="theme-button theme-button-secondary px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="theme-button px-5 py-2 text-sm disabled:opacity-60"
                  >
                    {submitting ? 'Recording...' : editorMode === 'opening' ? 'Add opening stock' : 'Save adjustment'}
                  </button>
                </div>
              </form>
            )}

            {/* Inventory Table */}
            {filteredItems.length ? (
              <>
              <p className="scroll-hint">Scroll sideways for all columns →</p>
              <div className="panel-scroll mt-4">
                <table className="theme-table min-w-[760px] text-left text-sm">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Stock on hand</th>
                      <th>Safety stock</th>
                      <th>Reorder point</th>
                      <th>Inventory status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const stock = Number(item.stock || 0)
                      const reorder = Number(item.reorder_point || 0)
                      const isOutOfStock = stock <= 0
                      const isLowStock = stock > 0 && stock <= reorder
                      const isArchived = item.is_active === false

                      return (
                        <tr key={item.id} className={isArchived ? 'opacity-65' : ''}>
                          <td className="font-medium text-[var(--text-strong)]">{item.name}</td>
                          <td className="font-mono text-xs text-[var(--text-muted)]">{item.sku}</td>
                          <td>{item.category || 'General'}</td>
                          <td className="font-semibold tabular-nums text-[var(--text-strong)]">{stock} units</td>
                          <td className="tabular-nums text-[var(--text-muted)]">{item.safety_stock || 0}</td>
                          <td className="tabular-nums text-[var(--text-muted)]">{reorder}</td>
                          <td>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isOutOfStock
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : isLowStock
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {isOutOfStock ? 'Out of stock' : isLowStock ? 'Low stock' : 'Healthy'}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openAdjustStockModal(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-[var(--border-strong)] hover:text-[var(--primary)]"
                              >
                                <Edit3 size={13} />
                                Adjust stock
                              </button>
                              {isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => void handleReactivate(item.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                                >
                                  <ArchiveRestore size={13} />
                                  Reactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmArchiveModal({ id: item.id, name: item.name })}
                                  className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/20"
                                  title="Archive product"
                                >
                                  <Archive size={13} />
                                  Archive
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDelete(item)}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1 text-rose-400 hover:bg-rose-500/20"
                                title="Delete product"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <EmptyState
                title={search.trim() ? 'No inventory records match your search' : 'No inventory data available'}
                description={
                  search.trim()
                    ? 'Try another product name or SKU.'
                    : 'Add products and record stock movements to populate inventory analytics.'
                }
              />
            )}
          </div>

          {/* Recent Movement Audit Trail */}
          <div className="theme-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="panel-eyebrow">Stock audit log</p>
                <h3 className="panel-title">Recent stock movements</h3>
              </div>
              <a href="/stock-movements" className="text-xs font-semibold text-[var(--primary)] hover:underline">
                View all movements & receipts →
              </a>
            </div>

            {movements.length ? (
              <div className="space-y-2">
                {movements.slice(0, 6).map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5 text-xs text-[var(--text)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-[var(--text-strong)]">{movement.product_name}</span>
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                        {movement.movement_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-[var(--text-strong)] tabular-nums">
                        {movement.quantity} units
                      </span>
                      <span className="text-[var(--text-muted)]">{movement.movement_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No movements recorded" description="Movement history will appear here." />
            )}
          </div>
        </div>
      )}
    </MainLayout>
  )
}
