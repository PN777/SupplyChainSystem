import api from './api'

export const getPurchaseOrders = async (params?: Record<string, string | number>) => {
  const response = await api.get('/purchase-orders', { params })
  return response.data.data || []
}

export const getPurchaseOrder = async (id: number) => {
  const response = await api.get(`/purchase-orders/${id}`)
  return response.data.data
}

export const createPurchaseOrder = async (payload: Record<string, unknown>) => {
  const response = await api.post('/purchase-orders', payload)
  return response.data.data
}

export const updatePurchaseOrder = async (id: number, payload: Record<string, unknown>) => {
  const response = await api.put(`/purchase-orders/${id}`, payload)
  return response.data.data
}

export const updatePurchaseOrderStatus = async (id: number, status: string) => {
  const response = await api.patch(`/purchase-orders/${id}/status`, { status })
  return response.data.data
}

export const receivePurchaseOrder = async (id: number, payload?: { received_date?: string }) => {
  const response = await api.post(`/purchase-orders/${id}/receive`, payload || {})
  return response.data.data
}

export const cancelPurchaseOrder = async (id: number) => {
  const response = await api.post(`/purchase-orders/${id}/cancel`)
  return response.data.data
}

/** Permanently delete a Draft, Pending, or Cancelled purchase order. */
export const deletePurchaseOrder = async (id: number) => {
  const response = await api.delete(`/purchase-orders/${id}`)
  return response.data
}

/** Advance a PO through Draft → Pending → Approved → Shipped transitions. */
export const advancePurchaseOrderStatus = async (id: number, newStatus: string) => {
  const response = await api.patch(`/purchase-orders/${id}/status`, { status: newStatus })
  return response.data.data
}
