import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Archive, ArchiveRestore, CheckCircle2, Plus, Search, Trash2 } from 'lucide-react'
import { MainLayout } from '../components/layout/MainLayout'
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  archiveSupplier,
  reactivateSupplier,
  deleteSupplier,
  importSuppliers,
} from '../services/supplierService'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorMessage } from '../components/common/ErrorMessage'
import type { Supplier } from '../types'

type SupplierForm = {
  name: string
  email: string
  phone: string
  address: string
}

const emptyForm = (): SupplierForm => ({
  name: '',
  email: '',
  phone: '',
  address: '',
})

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState<SupplierForm>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [archiveModal, setArchiveModal] = useState<{ id: number; name: string } | null>(null)
  const [deleteModal, setDeleteModal] = useState<Supplier | null>(null)
  const [confirmArchiveModal, setConfirmArchiveModal] = useState<Supplier | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await getSuppliers({ include_archived: 'true' })
      setSuppliers(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

    const name = form.name.trim()
    if (!name) {
      setError('Supplier name is required.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const payload = {
        name,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      }

      if (editingId === null) {
        await createSupplier(payload)
        setSuccess(`Supplier "${name}" registered successfully.`)
      } else {
        await updateSupplier(editingId, payload)
        setSuccess(`Supplier "${name}" updated successfully.`)
      }

      setForm(emptyForm())
      setEditingId(null)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save supplier')
    } finally {
      setSaving(false)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    return suppliers.filter((supplier) => {
      const isArchived = supplier.is_active === false
      if (statusFilter === 'active' && isArchived) return false
      if (statusFilter === 'archived' && !isArchived) return false

      const searchable = [supplier.name, supplier.email, supplier.phone, supplier.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return !normalizedSearch || searchable.includes(normalizedSearch)
    })
  }, [suppliers, statusFilter, normalizedSearch])

  const startEditing = (supplier: Supplier) => {
    setEditingId(supplier.id)
    setForm({
      name: supplier.name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    })
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  const handleArchive = async (id: number) => {
    try {
      await archiveSupplier(id)
      setArchiveModal(null)
      setConfirmArchiveModal(null)
      setSuccess('Supplier archived successfully. Purchase order records are preserved.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive supplier')
    }
  }

  const handleReactivate = async (id: number) => {
    try {
      await reactivateSupplier(id)
      setSuccess('Supplier reactivated successfully and available for purchase orders.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reactivate supplier')
    }
  }

  const handleDelete = (supplier: Supplier) => {
    setDeleteModal(supplier)
  }

  const executeDelete = async (supplier: Supplier) => {
    try {
      await deleteSupplier(supplier.id)
      setDeleteModal(null)
      setSuccess(`Supplier "${supplier.name}" permanently deleted.`)
      await load()
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Unable to delete supplier'
      setDeleteModal(null)
      setError(msg)
      setArchiveModal({ id: supplier.id, name: supplier.name })
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const result = await importSuppliers(file)
      setSuccess(`${result.imported} supplier(s) imported, ${result.skipped} existing skipped.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import suppliers')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <MainLayout title="Suppliers" onRefresh={load}>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-5">
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
                    <h4 className="text-base font-semibold text-[var(--text-strong)]">Delete Supplier</h4>
                    <p className="mt-1 text-sm font-medium text-[var(--text-strong)]">
                      "{deleteModal.name}"
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      Suppliers with associated purchase orders or products cannot be permanently deleted. You can safely archive them instead to retain procurement audit integrity.
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
                    <h4 className="text-base font-semibold text-[var(--text-strong)]">Archive Supplier</h4>
                    <p className="mt-1 text-sm font-medium text-[var(--text-strong)]">
                      "{confirmArchiveModal.name}"
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      Archiving deactivates this supplier from new purchase orders while preserving historical orders, performance ratings, and delivery reports.
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
                      "{archiveModal.name}" is referenced by existing products or purchase orders. To preserve
                      procurement audit history, archive this supplier instead of permanent deletion.
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
                    Archive supplier
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-muted)]">Directory status:</span>
              <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-1 text-xs">
                {(['active', 'archived', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`rounded-lg px-3 py-1 font-medium capitalize transition ${
                      statusFilter === filter
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                    }`}
                  >
                    {filter} (
                    {
                      suppliers.filter((s) =>
                        filter === 'all' ? true : filter === 'active' ? s.is_active !== false : s.is_active === false
                      ).length
                    }
                    )
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
                    setForm(emptyForm())
                    setShowForm(true)
                  }
                }}
                className="theme-button inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2 text-sm"
              >
                <Plus size={16} />
                <span>{showForm && editingId === null ? 'Close form' : 'Add supplier'}</span>
              </button>
            </div>
          </div>

          {/* Supplier Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="theme-panel space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <p className="panel-eyebrow">Supplier directory</p>
                  <h3 className="panel-title">{editingId !== null ? 'Edit supplier details' : 'Register new supplier'}</h3>
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
                  <span className="text-[var(--text)]">Supplier name <span className="text-violet-400">*</span></span>
                  <input
                    required
                    className="theme-input"
                    placeholder="e.g. Northwind Components"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Email address</span>
                  <input
                    type="email"
                    className="theme-input"
                    placeholder="orders@supplier.com"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Phone number</span>
                  <input
                    className="theme-input"
                    placeholder="+1 555-0101"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">Physical address</span>
                  <input
                    className="theme-input"
                    placeholder="City, State"
                    value={form.address}
                    onChange={(event) => setForm({ ...form, address: event.target.value })}
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
                  disabled={saving}
                  className="theme-button px-5 py-2 text-sm disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId === null ? 'Save supplier' : 'Update supplier'}
                </button>
              </div>
            </form>
          )}

          {/* Directory Panel */}
          <div className="theme-panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="control-grow relative max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  className="theme-input pl-9"
                  placeholder="Search suppliers by name, email, or city..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <p className="whitespace-nowrap text-xs text-[var(--text-muted)]">
                Showing {filtered.length} supplier{filtered.length === 1 ? '' : 's'}
              </p>
            </div>

            {filtered.length ? (
              <>
              <p className="scroll-hint">Scroll sideways for all columns →</p>
              <div className="panel-scroll">
                <table className="theme-table min-w-[750px] text-left text-sm">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((supplier) => {
                      const isArchived = supplier.is_active === false
                      return (
                        <tr key={supplier.id} className={isArchived ? 'opacity-65' : ''}>
                          <td className="font-semibold text-[var(--text-strong)]">{supplier.name}</td>
                          <td className="text-[var(--text-muted)]">{supplier.email || '—'}</td>
                          <td className="text-[var(--text-muted)]">{supplier.phone || '—'}</td>
                          <td>{supplier.address || '—'}</td>
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
                                onClick={() => startEditing(supplier)}
                                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-[var(--border-strong)] hover:text-[var(--primary)]"
                              >
                                Edit
                              </button>
                              {isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => void handleReactivate(supplier.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20"
                                >
                                  <ArchiveRestore size={13} />
                                  Reactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmArchiveModal(supplier)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20"
                                  title="Archive supplier"
                                >
                                  <Archive size={13} />
                                  Archive
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDelete(supplier)}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1 text-rose-400 transition hover:bg-rose-500/20"
                                title="Delete supplier"
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
                title={search.trim() ? 'No suppliers match your search' : 'No suppliers registered'}
                description={
                  search.trim()
                    ? 'Try another search term.'
                    : 'Click "Add supplier" to begin managing procurement partners.'
                }
              />
            )}
          </div>
        </div>
      )}
    </MainLayout>
  )
}
