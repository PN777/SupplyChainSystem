import api from './api'

export const getDashboardAnalytics = async () => {
  const response = await api.get('/analytics/dashboard')
  return response.data.data || {}
}

export const getInventoryAnalytics = async () => {
  const response = await api.get('/analytics/inventory')
  return response.data.data || { chart: [] }
}

export const getSuppliersAnalytics = async () => {
  const response = await api.get('/analytics/suppliers')
  return response.data.data || []
}

export const getDemandAnalytics = async (productId?: number, startDate?: string, endDate?: string) => {
  const params = { ...(productId ? { product_id: productId } : {}), ...(startDate ? { start_date: startDate } : {}), ...(endDate ? { end_date: endDate } : {}) }
  const response = await api.get('/analytics/demand', { params })
  return response.data.data || { chart: [] }
}
