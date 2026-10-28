import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import DashboardPage from './pages/Dashboard'
import InventoryPage from './pages/Inventory'
import StockMovementsPage from './pages/StockMovements'
import ProductsPage from './pages/Products'
import SuppliersPage from './pages/Suppliers'
import PurchaseOrdersPage from './pages/PurchaseOrders'
import ForecastingPage from './pages/Forecasting'
import AnalyticsPage from './pages/Analytics'
import SettingsPage from './pages/Settings'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/stock-movements" element={<StockMovementsPage />} />
          <Route path="/forecasting" element={<ForecastingPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
