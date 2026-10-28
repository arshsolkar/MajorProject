import { clearAuthSession, getStoredAuthSession } from './authStorage'
import { notifyAuthSessionExpired } from '../auth/authEvents'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorMessageFor(status) {
  const messages = {
    401: 'Your session could not be verified. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource could not be found.',
    422: 'Please review the information provided and try again.',
  }
  return messages[status] || (status >= 500
    ? 'The server could not complete your request. Please try again later.'
    : 'Your request could not be completed. Please try again.')
}

async function request(path, { method = 'GET', data, formData, headers = {}, token, authenticated = true, errorMessages } = {}) {
  const authToken = token ?? (authenticated ? getStoredAuthSession() : null)
  const requestHeaders = { Accept: 'application/json', ...headers }
  if (data !== undefined) requestHeaders['Content-Type'] = 'application/json'
  if (authToken?.access_token) requestHeaders.Authorization = `${authToken.token_type} ${authToken.access_token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: formData ?? (data === undefined ? undefined : JSON.stringify(data)),
    })
  } catch {
    throw new ApiError('Unable to reach HireSense AI. Please check your connection and try again.', 0)
  }

  if (response.status === 204) return null
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && authenticated) {
      clearAuthSession()
      notifyAuthSessionExpired()
    }
    throw new ApiError(errorMessages?.[response.status] || errorMessageFor(response.status), response.status)
  }
  return payload
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, data, options) => request(path, { ...options, method: 'POST', data }),
  postForm: (path, formData, options) => request(path, { ...options, method: 'POST', formData }),
  put: (path, data, options) => request(path, { ...options, method: 'PUT', data }),
  patch: (path, data, options) => request(path, { ...options, method: 'PATCH', data }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  download: async (path, { accept = 'application/octet-stream', method = 'GET', data, headers = {} } = {}) => {
    const authToken = getStoredAuthSession()
    let response
    const requestHeaders = { Accept: accept, ...headers, ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(authToken?.access_token ? { Authorization: `${authToken.token_type} ${authToken.access_token}` } : {}) }
    try { response = await fetch(`${API_BASE_URL}${path}`, { method, headers: requestHeaders, body: data === undefined ? undefined : JSON.stringify(data) }) }
    catch { throw new ApiError('Unable to reach HireSense AI. Please check your connection and try again.', 0) }
    if (!response.ok) { if (response.status === 401) { clearAuthSession(); notifyAuthSessionExpired() }; throw new ApiError(errorMessageFor(response.status), response.status) }
    return { blob: await response.blob(), filename: response.headers.get('Content-Disposition')?.match(/filename=([^;]+)/)?.[1] || 'download.csv' }
  },
}
