import * as api from '@fivematch/api-client'
import axios from 'axios'

type GetToken = (options?: { template?: string; skipCache?: boolean }) => Promise<string | null>
let _getToken: GetToken | null = null

export function setClerkGetToken(fn: GetToken): void {
  _getToken = fn
}

export const httpClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  timeout: 10_000,
})

httpClient.interceptors.request.use(async (config) => {
  if (_getToken) {
    const token = await _getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// On 401: force-refresh the token and retry exactly once. Query/mutation hooks never handle 401 themselves.
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry && _getToken) {
      original._retry = true
      const freshToken = await _getToken({ skipCache: true })
      if (freshToken) {
        original.headers.Authorization = `Bearer ${freshToken}`
      }
      return httpClient(original)
    }
    return Promise.reject(error)
  },
)

export { api }
