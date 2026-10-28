import api from './api'

export const getDemandHistory = async (productId?: number) => {
  const response = await api.get('/demand', { params: productId ? { product_id: productId } : {} })
  return response.data.data || []
}

export const createDemandEntry = async (payload: Record<string, unknown>) => {
  const response = await api.post('/demand', payload)
  return response.data.data
}

export const importDemandCsv = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/demand/import', formData)
  return response.data.data
}

export const updateDemandEntry = async (id: number, payload: Record<string, unknown>) => {
  const response = await api.put(`/demand/${id}`, payload)
  return response.data.data
}

export const deleteDemandEntry = async (id: number) => {
  const response = await api.delete(`/demand/${id}`)
  return response.data
}

export const getForecast = async (productId: number, horizon = 7) => {
  const response = await api.get('/forecast', { params: { product_id: productId, horizon } })
  return response.data.data
}
