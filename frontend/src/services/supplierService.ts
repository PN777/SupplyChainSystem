import api from './api'

export const getSuppliers = async (params?: Record<string, string | number | boolean>) => {
  const response = await api.get('/suppliers', { params })
  return response.data.data
}

export const getSupplier = async (id: number) => {
  const response = await api.get(`/suppliers/${id}`)
  return response.data.data
}

export const createSupplier = async (payload: Record<string, any>) => {
  const response = await api.post('/suppliers', payload)
  return response.data.data
}

export const updateSupplier = async (id: number, payload: Record<string, any>) => {
  const response = await api.put(`/suppliers/${id}`, payload)
  return response.data.data
}

export const archiveSupplier = async (id: number) => {
  const response = await api.post(`/suppliers/${id}/archive`)
  return response.data.data
}

export const reactivateSupplier = async (id: number) => {
  const response = await api.post(`/suppliers/${id}/reactivate`)
  return response.data.data
}

export const deleteSupplier = async (id: number) => {
  const response = await api.delete(`/suppliers/${id}`)
  return response.data
}

export const importSuppliers = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  const response = await api.post('/suppliers/import', form)
  return response.data.data
}
