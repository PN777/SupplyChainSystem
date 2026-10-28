import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

type Props = { data: Array<{ name: string; value: number }> }

const COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#312e81', '#e9d5ff']

export function InventoryChart({ data }: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="theme-card chart-card w-full h-full flex flex-col justify-between">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="panel-eyebrow">Stock status</p>
          <h3 className="mt-1 panel-title">Inventory overview</h3>
        </div>
      </div>

      {total > 0 ? (
        <div className="inventory-chart-body flex-1 min-h-[220px] flex min-h-0 flex-col gap-3 md:flex-row md:items-center">
          <div className="h-[190px] min-w-0 flex-1 md:h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={46} outerRadius={72} paddingAngle={4}>
                  {data.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [String(value ?? 0), 'Items'] as [string, string]}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-strong)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:w-40 md:grid-cols-1">
            {data.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between gap-2 text-xs text-[var(--text)]">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  {item.name}
                </span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex chart-body items-center justify-center text-sm text-[var(--text-muted)]">No stock records available.</div>
      )}
    </div>
  )
}
