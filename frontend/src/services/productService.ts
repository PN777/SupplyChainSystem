import api from './api'
import type { Product } from '../types'

export const getProducts = async (params?: Record<string, string | number>) => {
  const response = await api.get('/products', { params })
  return response.data.data
}

export const getAllProducts = async (params?: Record<string, string | number>) => {
  const firstPage = await getProducts({ page: 1, per_page: 100, ...params })
  const items = [...(firstPage.items || [])]
  for (let page = 2; page <= (firstPage.pages || 0); page += 1) {
    const nextPage = await getProducts({ page, per_page: 100, ...params })
    items.push(...(nextPage.items || []))
  }
  return items
}

export const createProduct = async (payload: Partial<Product>) => {
  const response = await api.post('/products', payload)
  return response.data.data
}

export const updateProduct = async (id: number, payload: Partial<Product>) => {
  const response = await api.put(`/products/${id}`, payload)
  return response.data.data
}

export const archiveProduct = async (id: number) => {
  const response = await api.post(`/products/${id}/archive`)
  return response.data.data
}

export const reactivateProduct = async (id: number) => {
  const response = await api.post(`/products/${id}/reactivate`)
  return response.data.data
}

export const deleteProduct = async (id: number) => {
  const response = await api.delete(`/products/${id}`)
  return response.data
}

export const importProducts = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  const response = await api.post('/products/import', form)
  return response.data.data
}
