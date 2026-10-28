import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Archive, ArchiveRestore, CheckCircle2, Filter, Plus, Search, Trash2 } from 'lucide-react'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { EmptyState } from '../components/common/EmptyState'
import { MainLayout } from '../components/layout/MainLayout'
import {
  getAllProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  reactivateProduct,
  deleteProduct,
  importProducts,
} from '../services/productService'
import { createSupplier, getSuppliers } from '../services/supplierService'
import type { Product, Supplier } from '../types'

type ProductForm = {
  sku: string
  name: string
  category: string
  unit_cost: string
  lead_time_days: string
  safety_stock: string
  max_stock: string
  supplier_id: string
  new_supplier_name: string
  new_supplier_email: string
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const emptyProductForm = (): ProductForm => ({
  sku: '',
  name: '',
  category: 'General',
  unit_cost: '',
  lead_time_days: '7',
  safety_stock: '0',
  max_stock: '100',
  supplier_id: '',
  new_supplier_name: '',
  new_supplier_email: '',
})

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [page, setPage] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyProductForm())
  const [showForm, setShowForm] = useState(false)
  const [archiveModal, setArchiveModal] = useState<{ id: number; name: string } | null>(null)
  const [deleteModal, setDeleteModal] = useState<Product | null>(null)
  const [confirmArchiveModal, setConfirmArchiveModal] = useState<Product | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const [allProducts, supplierList] = await Promise.all([
        getAllProducts({ include_archived: 'true' }),
        getSuppliers({ include_archived: 'true' }),
      ])
      setProducts(allProducts)
      setSuppliers(supplierList)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((product) => {
      const isArchived = product.is_active === false
      if (statusFilter === 'active' && isArchived) return false
      if (statusFilter === 'archived' && !isArchived) return false

      const searchable = [
        product.name,
        product.sku,
        product.category,
        product.supplier_name,
        product.current_stock,
        product.reorder_point,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase()

      const stock = Number(product.current_stock || 0)
      const reorderPoint = Number(product.reorder_point || 0)
      const maxStock = Number(product.max_stock || 0)

      const matchesStock =
        !stockStatus ||
        (stockStatus === 'low' && stock <= reorderPoint && stock > 0) ||
        (stockStatus === 'out' && stock <= 0) ||
        (stockStatus === 'excess' && maxStock > 0 && stock > maxStock) ||
        (stockStatus === 'healthy' && stock > reorderPoint && (maxStock === 0 || stock <= maxStock))

      return (!term || searchable.includes(term)) && matchesStock
    })
  }, [products, search, stockStatus, statusFilter])

  const totalPages = Math.ceil(filteredProducts.length / 10)
  const visibleProducts = filteredProducts.slice((page - 1) * 10, page * 10)

  useEffect(() => {
    if (page > Math.max(1, totalPages)) setPage(1)
  }, [totalPages, page])

  const resolveSupplierId = async (): Promise<{ id: number | null; createdName?: string }> => {
    if (form.supplier_id !== '__new__') {
      return { id: form.supplier_id ? Number(form.supplier_id) : null }
    }
    const newName = form.new_supplier_name.trim()
    if (!newName) {
      throw new Error('Enter a name for the new supplier, or pick an existing supplier.')
    }
    const existing = suppliers.find((supplier) => supplier.name.trim().toLowerCase() === newName.toLowerCase())
    if (existing) {
      return { id: existing.id }
    }
    const created = await createSupplier({
      name: newName,
      email: form.new_supplier_email.trim() || undefined,
    })
    return { id: created.id, createdName: created.name }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    const sku = form.sku.trim()
    const name = form.name.trim()
    if (!sku || !name) {
      setError('SKU and Product Name are required fields.')
      return
    }

    const unitCost = form.unit_cost === '' ? 0 : Number(form.unit_cost)
    const leadTime = form.lead_time_days === '' ? 7 : Number(form.lead_time_days)
    const safetyStock = form.safety_stock === '' ? 0 : Number(form.safety_stock)
    const maxStock = form.max_stock === '' ? 0 : Number(form.max_stock)

    if (
      !Number.isFinite(unitCost) ||
      unitCost < 0 ||
      !Number.isInteger(leadTime) ||
      leadTime < 0 ||
      !Number.isInteger(safetyStock) ||
      safetyStock < 0 ||
      !Number.isInteger(maxStock) ||
      maxStock < 0
    ) {
      setError('Cost must be non-negative; lead time, safety stock, and max stock must be non-negative whole numbers.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      const supplier = await resolveSupplierId()
      const supplierNote = supplier.createdName ? ` New supplier "${supplier.createdName}" added.` : ''
      const payload: Partial<Product> = {
        sku,
        name,
        category: form.category.trim() || 'General',
        unit_cost: unitCost,
        lead_time_days: leadTime,
        safety_stock: safetyStock,
        max_stock: maxStock,
        supplier_id: supplier.id,
      }

      if (editingId !== null) {
        await updateProduct(editingId, payload)
        setSuccess(`Product "${name}" updated successfully.${supplierNote}`)
      } else {
        await createProduct(payload)
        setSuccess(`Product "${name}" created successfully and ready for inventory tracking.${supplierNote}`)
      }

      setForm(emptyProductForm())
      setEditingId(null)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartEdit = (product: Product) => {
    setEditingId(product.id)
    setForm({
      sku: product.sku,
      name: product.name,
      category: product.category || 'General',
      unit_cost: String(product.unit_cost),
      lead_time_days: String(product.lead_time_days),
      safety_stock: String(product.safety_stock),
      max_stock: String(product.max_stock),
      supplier_id: product.supplier_id ? String(product.supplier_id) : '',
      new_supplier_name: '',
      new_supplier_email: '',
    })
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  const handleArchive = async (id: number) => {
    try {
      await archiveProduct(id)
      setArchiveModal(null)
      setConfirmArchiveModal(null)
      setSuccess('Product archived successfully. Historical records are preserved.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive product.')
    }
  }

  const handleReactivate = async (id: number) => {
    try {
      await reactivateProduct(id)
      setSuccess('Product reactivated successfully and returned to the active catalog.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reactivate product.')
    }
  }

  const handleDelete = (product: Product) => {
    setDeleteModal(product)
  }

  const executeDelete = async (product: Product) => {
    try {
      await deleteProduct(product.id)
      setDeleteModal(null)
      setSuccess(`Product "${product.name}" permanently deleted.`)
      await load()
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Unable to delete product'
      setDeleteModal(null)
      setError(msg)
      setArchiveModal({ id: product.id, name: product.name })
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const result = await importProducts(file)
      setSuccess(`${result.imported} product(s) imported, ${result.skipped} existing SKU(s) skipped.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import products CSV.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <MainLayout title="Products" onRefresh={load}>
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
                      Products with recorded inventory movements, orders, or demand cannot be permanently deleted. You can safely archive them instead to retain database audit integrity.
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
                      "{confirmArchiveModal.name}" <span className="font-mono text-xs text-[var(--text-muted)]">({confirmArchiveModal.sku})</span>
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      Archiving removes this product from new purchase orders and active transactions while preserving all historical movements, orders, and reports.
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
                      "{archiveModal.name}" has audit records (inventory movements, purchase orders, or demand). To
                      maintain database integrity, archive it instead of permanent deletion.
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

          {/* Action Header & Toggle Form Button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-muted)]">Catalog status:</span>
              <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-1 text-xs">
                {(['active', 'archived', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => {
                      setStatusFilter(filter)
                      setPage(1)
                    }}
                    className={`rounded-lg px-3 py-1 font-medium capitalize transition ${
                      statusFilter === filter
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                    }`}
                  >
                    {filter} ({products.filter((p) => filter === 'all' || (filter === 'active' ? p.is_active !== false : p.is_active === false)).length})
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-toolbar-actions">
              <label className="theme-button theme-button-secondary inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap px-3.5 py-2 text-sm">
                <span>Import CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (showForm && editingId === null) {
                    setShowForm(false)
                  } else {
                    setEditingId(null)
                    setForm(emptyProductForm())
                    setShowForm(true)
                  }
                }}
                className="theme-button inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2 text-sm"
              >
                <Plus size={16} />
                <span>{showForm && editingId === null ? 'Close form' : 'Add product'}</span>
              </button>
            </div>
          </div>

          {/* Product Form Card */}
          {showForm && (
            <form onSubmit={handleSubmit} className="theme-panel space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <p className="panel-eyebrow">Catalog editor</p>
                  <h3 className="panel-title">{editingId !== null ? 'Edit product details' : 'Register new product'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                  }}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">SKU <span className="text-violet-400">*</span></span>
                  <input
                    required
                    className="theme-input"
                    placeholder="e.g. SC-1001"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Product name <span className="text-violet-400">*</span></span>
                  <input
                    required
                    className="theme-input"
                    placeholder="e.g. Alpha Sensor Node"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Category</span>
                  <input
                    className="theme-input"
                    placeholder="e.g. Electronics"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Supplier</span>
                  <select
                    className="theme-input"
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  >
                    <option value="">No assigned supplier</option>
                    {suppliers
                      .filter((s) => s.is_active !== false || s.id === Number(form.supplier_id))
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} {supplier.is_active === false ? '(Archived)' : ''}
                        </option>
                      ))}
                    <option value="__new__">+ Add a new supplier…</option>
                  </select>
                </label>
                {form.supplier_id === '__new__' && (
                  <>
                    <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                      <span className="text-[var(--text)]">New supplier name <span className="text-violet-400">*</span></span>
                      <input
                        required
                        className="theme-input"
                        placeholder="e.g. Acme Components"
                        value={form.new_supplier_name}
                        onChange={(e) => setForm({ ...form, new_supplier_name: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                      <span className="text-[var(--text)]">New supplier email <span className="text-xs">(optional)</span></span>
                      <input
                        type="email"
                        className="theme-input"
                        placeholder="orders@acme.com"
                        value={form.new_supplier_email}
                        onChange={(e) => setForm({ ...form, new_supplier_email: e.target.value })}
                      />
                    </label>
                  </>
                )}
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Unit cost (USD)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="theme-input"
                    placeholder="0.00"
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Lead time (days)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="theme-input"
                    placeholder="7"
                    value={form.lead_time_days}
                    onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Safety stock threshold</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="theme-input"
                    placeholder="0"
                    value={form.safety_stock}
                    onChange={(e) => setForm({ ...form, safety_stock: e.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Max stock threshold</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="theme-input"
                    placeholder="0"
                    value={form.max_stock}
                    onChange={(e) => setForm({ ...form, max_stock: e.target.value })}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                  }}
                  className="theme-button theme-button-secondary px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="theme-button px-5 py-2 text-sm disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingId !== null ? 'Update product' : 'Create product'}
                </button>
              </div>
            </form>
          )}

          {/* Product Directory & Table Panel */}
          <div className="theme-panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="control-row flex-1">
                <div className="control-grow relative max-w-sm">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    className="theme-input pl-9"
                    placeholder="Search name, SKU, or category..."
                    value={search}
                    onChange={(event) => {
                      setPage(1)
                      setSearch(event.target.value)
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={15} className="text-[var(--text-muted)]" />
                  <select
                    className="theme-input control-fixed control-w-lg"
                    value={stockStatus}
                    onChange={(event) => {
                      setPage(1)
                      setStockStatus(event.target.value)
                    }}
                  >
                    <option value="">All inventory levels</option>
                    <option value="healthy">Healthy stock</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                    <option value="excess">Excess stock</option>
                  </select>
                </div>
              </div>
              <p className="whitespace-nowrap text-xs text-[var(--text-muted)]">
                Showing {visibleProducts.length} of {filteredProducts.length} products
              </p>
            </div>

            {visibleProducts.length ? (
              <>
              <p className="scroll-hint">Scroll sideways for all columns →</p>
              <div className="panel-scroll">
                <table className="theme-table min-w-[780px] text-left text-sm">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product name</th>
                      <th>Category</th>
                      <th>Supplier</th>
                      <th>Unit cost</th>
                      <th>Stock status</th>
                      <th>Reorder pt</th>
                      <th>State</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => {
                      const isArchived = product.is_active === false
                      const stock = Number(product.current_stock || 0)
                      const reorder = Number(product.reorder_point || 0)
                      const isOutOfStock = stock <= 0
                      const isLowStock = stock > 0 && stock <= reorder

                      return (
                        <tr key={product.id} className={isArchived ? 'opacity-65' : ''}>
                          <td className="font-mono text-xs font-semibold text-[var(--text-strong)]">{product.sku}</td>
                          <td>
                            <div className="font-medium text-[var(--text-strong)]">{product.name}</div>
                          </td>
                          <td>{product.category || 'General'}</td>
                          <td>{product.supplier_name || '—'}</td>
                          <td className="tabular-nums">{currency.format(Number(product.unit_cost) || 0)}</td>
                          <td>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                isOutOfStock
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : isLowStock
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {stock} units {isOutOfStock ? '(Stockout)' : isLowStock ? '(Low)' : ''}
                            </span>
                          </td>
                          <td className="tabular-nums text-[var(--text-muted)]">{reorder} units</td>
                          <td>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                isArchived
                                  ? 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                                  : 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                              }`}
                            >
                              {isArchived ? 'Archived' : 'Active'}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(product)}
                                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-[var(--border-strong)] hover:text-[var(--primary)]"
                              >
                                Edit
                              </button>
                              {isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => void handleReactivate(product.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20"
                                >
                                  <ArchiveRestore size={13} />
                                  Reactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmArchiveModal(product)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20"
                                  title="Archive product (preserves historical movements and POs)"
                                >
                                  <Archive size={13} />
                                  Archive
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDelete(product)}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1 text-rose-400 transition hover:bg-rose-500/20"
                                title="Delete product permanently"
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
                title={search.trim() || stockStatus ? 'No matching products found' : 'No products in this view'}
                description={
                  search.trim() || stockStatus
                    ? 'Try adjusting your search terms or stock filters.'
                    : 'Click "Add product" to register items in the catalog.'
                }
              />
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="theme-button theme-button-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="theme-button theme-button-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  )
}
