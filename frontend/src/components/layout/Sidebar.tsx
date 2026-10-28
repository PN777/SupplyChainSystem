import { useState } from 'react'
import {
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Package,
  Settings,
  ShieldCheck,
  Truck,
  Warehouse,
  TrendingUp,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { BrandMark } from '../common/BrandMark'

export const navSections = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: BarChart3 }],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/inventory', label: 'Inventory', icon: Warehouse },
      { to: '/stock-movements', label: 'Stock Movements', icon: Boxes },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { to: '/forecasting', label: 'Demand Forecasting', icon: TrendingUp },
      { to: '/analytics', label: 'Analytics & Reports', icon: ShieldCheck },
    ],
  },
  {
    title: 'System',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`sidebar-shell sticky top-0 hidden h-screen shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] p-3 text-[var(--text)] lg:flex lg:flex-col ${
        collapsed ? 'w-[5.75rem]' : 'w-[16.75rem] xl:w-[17.5rem]'
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <BrandMark compact={collapsed} />
        </div>
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition hover:border-[var(--border-strong)] hover:text-[var(--primary)]"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav space-y-4 overflow-y-auto pr-1">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-2">
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `sidebar-link group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--text-strong)] shadow-lg shadow-violet-500/10'
                        : 'border-transparent text-[var(--text)] hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                >
                  <Icon size={18} className={collapsed ? '' : 'shrink-0'} />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
