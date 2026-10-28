type Props = { title: string; description?: string }

export function EmptyState({ title, description }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] px-6 py-10 text-center">
      <p className="text-sm font-semibold text-[var(--text-strong)]">{title}</p>
      {description ? <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p> : null}
    </div>
  )
}
