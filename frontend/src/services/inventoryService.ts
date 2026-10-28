import api from './api'

export const getStockSummary = async (params?: Record<string, any>) => {
  const response = await api.get('/stock/summary', { params })
  return response.data.products || response.data.data?.products || []
}

export const getStockAlerts = async (params?: Record<string, any>) => {
  const response = await api.get('/stock/alerts', { params })
  return response.data.data || response.data
}

export const getStockMovements = async (params?: Record<string, any>) => {
  const response = await api.get('/stock/movements', { params })
  return response.data.data || response.data
}

export const createStockMovement = async (payload: Record<string, unknown>) => {
  const response = await api.post('/stock/movements', payload)
  return response.data.data
}

export const getStockMovementReceipt = async (id: number) => {
  const response = await api.get(`/stock/movements/${id}/receipt`)
  return response.data.data
}
