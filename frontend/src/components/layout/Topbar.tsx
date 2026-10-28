import { useEffect, useMemo, useState } from 'react'
import { Bell, Menu, MoonStar, RefreshCw, Search, SunMedium, UserCircle2, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { getPurchaseOrders } from '../../services/purchaseOrderService'
import { getStockAlerts, getStockMovements } from '../../services/inventoryService'
import { getAllProducts } from '../../services/productService'
import { getSuppliers } from '../../services/supplierService'
import { navSections } from './Sidebar'
import { BrandMark } from '../common/BrandMark'

type Props = {
  title: string
  onRefresh: () => void
}

type NotificationItem = {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  timestamp: string
  link: string
  read: boolean
}

export function Topbar({ title, onRefresh }: Props) {
  const { theme, toggleTheme } = useTheme()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('Not yet refreshed')
  const [globalSearch, setGlobalSearch] = useState('')
  const [catalog, setCatalog] = useState<{ products: any[]; suppliers: any[] }>({ products: [], suppliers: [] })
  const location = useLocation()
  const sectionLabel = useMemo(
    () => navSections.find((section) => section.items.some((item) => item.to === location.pathname))?.title ?? 'Overview',
    [location.pathname],
  )

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const [alerts, orders, movements] = await Promise.all([getStockAlerts(), getPurchaseOrders(), getStockMovements()])
        const alertItems = (alerts || []).map((alert: any) => ({
          id: `alert-${alert.product_id}`,
          title: alert.status === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock alert',
          description: `${alert.product_name} is at ${alert.current_stock} units against a reorder point of ${alert.reorder_point}.`,
          severity: alert.status === 'OUT_OF_STOCK' ? 'critical' : 'warning',
          timestamp: new Date().toISOString(),
          link: '/inventory',
          read: false,
        }))

        const overdueOrders = (orders || [])
          .filter((order: any) => order.status !== 'Received' && order.status !== 'Cancelled')
          .filter((order: any) => {
            if (!order.expected_delivery_date) return false
            return new Date(order.expected_delivery_date) < new Date()
          })
          .map((order: any) => ({
            id: `po-${order.id}`,
            title: 'Delayed purchase order',
            description: `${order.supplier_name || 'Supplier'} order PO-${order.id} is past the expected delivery date.`,
            severity: 'warning',
            timestamp: order.expected_delivery_date,
            link: '/purchase-orders',
            read: false,
          }))

        const movementItems = (movements || []).slice(0, 3).map((movement: any) => ({
          id: `movement-${movement.id}`,
          title: 'Stock movement logged',
          description: `${movement.movement_type} for ${movement.product_name || 'product'} (${movement.quantity} units).`,
          severity: 'info',
          timestamp: movement.movement_date || new Date().toISOString(),
          link: '/inventory',
          read: false,
        }))

        setNotifications([...alertItems, ...overdueOrders, ...movementItems])
      } catch {
        setNotifications([])
      }
    }

    void loadNotifications()
  }, [onRefresh])

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [products, suppliers] = await Promise.all([getAllProducts(), getSuppliers()])
        setCatalog({ products, suppliers })
      } catch {
        setCatalog({ products: [], suppliers: [] })
      }
    }
    void loadCatalog()
  }, [])

  const globalResults = useMemo(() => {
    const term = globalSearch.trim().toLowerCase()
    if (!term) return []
    return [
      ...catalog.products.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(term)).slice(0, 5)
        .map((product) => ({ id: `product-${product.id}`, label: `${product.name} (${product.sku})`, type: 'Product', link: '/products' })),
      ...catalog.suppliers.filter((supplier) => `${supplier.name} ${supplier.email || ''} ${supplier.phone || ''}`.toLowerCase().includes(term)).slice(0, 5)
        .map((supplier) => ({ id: `supplier-${supplier.id}`, label: supplier.name, type: 'Supplier', link: '/suppliers' })),
    ]
  }, [catalog, globalSearch])

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications])

  const handleRefresh = async () => {
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    await onRefresh()
  }

  const markNotificationRead = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    )
  }

  return (
    <>
      <header className="topbar sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--sidebar)]/95 px-3 py-3 backdrop-blur-md sm:px-4 lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] lg:hidden"
              onClick={() => setShowMobileMenu((value) => !value)}
            >
              {showMobileMenu ? <X size={17} /> : <Menu size={17} />}
            </button>
            <div className="lg:hidden">
              <BrandMark compact />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">{sectionLabel}</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--text-strong)] sm:text-2xl">{title}</h2>
            </div>
          </div>

          <div className="topbar-actions flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 xl:justify-end">
            <div className="relative order-3 flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] shadow-sm shadow-[var(--shadow)] xl:order-1 xl:max-w-[380px] xl:flex-initial">
              <Search size={15} className="text-[var(--text-muted)]" />
              <input
                aria-label="Global search"
                placeholder="Search products, suppliers..."
                className="w-full min-w-0 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
              />
              {globalResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl">
                {globalResults.map((result) => (
                  <NavLink key={result.id} to={result.link} onClick={() => setGlobalSearch('')} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-alt)]">
                    <span className="text-[var(--text-strong)]">{result.label}</span><span className="text-xs text-[var(--text-muted)]">{result.type}</span>
                  </NavLink>
                ))}
              </div>
              )}
            </div>

            <div className="order-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)] xl:order-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Updated {lastUpdated}
            </div>

            <button
              type="button"
              aria-label="Notifications"
              className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[var(--text)] transition hover:border-[var(--border-strong)] hover:text-[var(--primary)]"
              onClick={() => setShowNotifications((value) => !value)}
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label="Theme preference"
              onClick={toggleTheme}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[var(--text)] transition hover:border-[var(--border-strong)] hover:text-[var(--primary)]"
            >
              {theme === 'dark' ? <SunMedium size={17} /> : <MoonStar size={17} />}
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh dashboard"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[var(--text)] transition hover:border-[var(--border-strong)] hover:text-[var(--primary)]"
            >
              <RefreshCw size={17} />
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
              <UserCircle2 size={18} className="text-[var(--primary)]" />
              <span className="hidden sm:inline">Operations Lead</span>
            </div>
          </div>
        </div>

        {showNotifications && (
          <div className="absolute right-3 top-full z-30 mt-2 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl shadow-[var(--shadow)] sm:right-4 lg:right-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">Notifications</h3>
              <span className="text-xs text-[var(--text-muted)]">{unreadCount} unread</span>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {notifications.length ? notifications.map((notification) => (
                <NavLink
                  key={notification.id}
                  to={notification.link}
                  onClick={() => markNotificationRead(notification.id)}
                  className={`block rounded-xl border p-3 transition ${notification.read ? 'border-[var(--border)] bg-transparent' : 'border-[var(--border-strong)] bg-[var(--primary-soft)]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-strong)]">{notification.title}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{notification.description}</p>
                    </div>
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${notification.severity === 'critical' ? 'bg-rose-500' : notification.severity === 'warning' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    <span>{notification.severity}</span>
                    <span>{new Date(notification.timestamp).toLocaleDateString()}</span>
                  </div>
                </NavLink>
              )) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-transparent p-4 text-sm text-[var(--text-muted)]">
                  No active notifications.
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {showMobileMenu && (
        <div className="border-b border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg shadow-[var(--shadow)] lg:hidden">
          <nav className="space-y-4">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1.5">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  {section.title}
                </p>
                {section.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setShowMobileMenu(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--text-strong)]'
                          : 'border-transparent text-[var(--text)] hover:bg-[var(--surface-alt)]'
                      }`
                    }
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}
