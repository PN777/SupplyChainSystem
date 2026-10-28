import { AlertTriangle, ArrowRight, Boxes } from 'lucide-react'
import { Link } from 'react-router-dom'

type Alert = {
  product_id: number
  product_name: string
  sku: string
  current_stock: number
  reorder_point: number
  status: string
}

export function InventoryAlerts({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="theme-card chart-card flex h-full flex-col justify-between">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="panel-eyebrow">Stock attention</p>
            <h3 className="mt-0.5 panel-title">Low stock alerts</h3>
          </div>
          {alerts.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              <AlertTriangle size={12} />
              {alerts.length} Items
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
              Optimal
            </span>
          )}
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-2.5">
            {alerts.slice(0, 4).map((alert) => {
              const isOut = alert.status === 'OUT_OF_STOCK' || alert.current_stock <= 0
              const ratio = alert.reorder_point > 0
                ? Math.min(100, Math.round((alert.current_stock / alert.reorder_point) * 100))
                : 0

              return (
                <div
                  key={alert.product_id}
                  className="theme-surface-alt rounded-xl p-2.5 transition hover:border-[var(--border-strong)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-strong)]">
                        {alert.product_name}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--text-muted)]">{alert.sku}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        isOut
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isOut ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>
                      Stock: <strong className="text-[var(--text-strong)]">{alert.current_stock}</strong> / Reorder: {alert.reorder_point}
                    </span>
                    <span className="font-medium text-[var(--text-muted)]">{ratio}%</span>
                  </div>

                  {/* Visual micro progress bar */}
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOut ? 'bg-rose-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.max(5, ratio)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center text-xs text-[var(--text-muted)]">
            <div className="rounded-full bg-emerald-500/10 p-2.5 text-emerald-400 mb-2">
              <Boxes size={20} />
            </div>
            <p className="font-medium text-[var(--text-strong)]">All stock levels healthy</p>
            <p className="mt-0.5 text-[var(--text-muted)]">No products currently below their reorder threshold.</p>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t border-[var(--border)]">
        <Link
          to="/inventory"
          className="inline-flex w-full items-center justify-between text-xs font-medium text-[var(--primary)] hover:text-[var(--text-strong)] transition-colors"
        >
          <span>Manage inventory stock</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}
