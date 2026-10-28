import type { ReactNode } from 'react'

type Props = {
  title: string
  value: string | number
  detail?: string
  icon: ReactNode
  accent?: string
}

export function StatCard({ title, value, detail, icon, accent = 'violet' }: Props) {
  const accentMap: Record<string, string> = {
    violet: 'bg-violet-500/12 text-violet-300 ring-1 ring-violet-400/20',
    emerald: 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/20',
    amber: 'bg-amber-500/12 text-amber-300 ring-1 ring-amber-400/20',
    cyan: 'bg-cyan-500/12 text-cyan-300 ring-1 ring-cyan-400/20',
    rose: 'bg-rose-500/12 text-rose-300 ring-1 ring-rose-400/20',
  }

  return (
    <div className="theme-card kpi-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{title}</p>
          <h3 className="mt-2.5 text-[1.55rem] font-semibold leading-tight text-[var(--text-strong)]">{value}</h3>
        </div>
        <div className={`rounded-xl p-2.5 ${accentMap[accent]}`}>{icon}</div>
      </div>
      {detail ? <p className="mt-2.5 text-xs text-[var(--text-muted)]">{detail}</p> : null}
    </div>
  )
}
