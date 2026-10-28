import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SupplierPerformance } from '../../types'

type Props = {
  data: SupplierPerformance[]
}

export function SupplierChart({ data }: Props) {
  const availableData = data.filter(
    (supplier) => supplier.on_time_delivery !== null && supplier.on_time_delivery !== undefined
  )

  return (
    <div className="theme-card chart-card w-full h-full flex flex-col justify-between">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="panel-eyebrow">Supplier score</p>
          <h3 className="mt-1 panel-title">Supplier performance</h3>
        </div>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
          On-Time Delivery
        </span>
      </div>

      {availableData.length ? (
        <div className="flex flex-1 flex-col justify-between space-y-2">
          <div className="chart-body flex-1 min-h-[220px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={availableData} layout="vertical" margin={{ left: 8, right: 10, top: 6, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="supplier"
                  width={110}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, _name: any, item: any) => {
                    const payload = item.payload
                    const details = payload.delivered_orders
                      ? ` (${payload.on_time_orders || 0} of ${payload.delivered_orders} on time)`
                      : ''
                    return [`${Number(value ?? 0)}%${details}`, 'On-time rate']
                  }}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: 'var(--text-strong)',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'rgba(139, 92, 246, 0.07)' }}
                />
                <Bar
                  dataKey="on_time_delivery"
                  fill="#8b5cf6"
                  radius={[0, 8, 8, 0]}
                  maxBarSize={26}
                  isAnimationActive
                  animationBegin={80}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">
            Rates reflect delivered purchase orders with verified expected vs receipt dates.
          </p>
        </div>
      ) : (
        <div className="chart-body flex items-center justify-center px-4 text-center text-sm text-[var(--text-muted)]">
          Supplier delivery performance is unavailable until purchase orders are received with expected delivery dates.
        </div>
      )}
    </div>
  )
}
