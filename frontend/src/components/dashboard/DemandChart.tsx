import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Props = { data: Array<{ date: string; quantity: number }> }

export function DemandChart({ data }: Props) {
  const hasData = data && data.length > 0

  return (
    <div className="theme-card chart-card w-full h-full flex flex-col justify-between">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="panel-eyebrow">Demand & Consumption</p>
          <h3 className="mt-1 panel-title">Daily demand trend</h3>
        </div>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-violet-300">
          Recent 30 Days
        </span>
      </div>

      <div className="chart-body flex-1 min-h-[250px] min-w-0">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="demandFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                unit=" u"
              />
              <Tooltip
                formatter={(value: any) => [`${Number(value).toLocaleString()} units`, 'Demand']}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--text-strong)',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="quantity"
                stroke="#8b5cf6"
                strokeWidth={2.4}
                fill="url(#demandFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            No demand history recorded. Add demand records to view consumption trends.
          </div>
        )}
      </div>
    </div>
  )
}
