export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10 text-[var(--text-muted)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
      <span className="ml-3 text-sm font-medium text-[var(--text)]">Loading…</span>
    </div>
  )
}
