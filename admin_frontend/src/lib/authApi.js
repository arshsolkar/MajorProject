import { apiClient } from './apiClient'

export { clearAuthSession, getStoredAuthSession, storeAuthSession } from './authStorage'
export { ApiError as AuthApiError } from './apiClient'

export async function login({ module, email, password }) {
  return apiClient.post('/auth/login', { module, email, password }, {
    authenticated: false,
    errorMessages: { 401: 'Invalid email or password', 403: 'This account is not approved for the selected module.' },
  })
}

export async function getCurrentUser(token) {
  return apiClient.get('/auth/me', { token })
}

export async function register(data) {
  return apiClient.post('/auth/register', data, {
    authenticated: false,
    errorMessages: { 409: 'An account with this email already exists.' },
  })
}

export async function registerRecruiterWithDocument(data, document) {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') formData.append(key, value)
  })
  formData.append('verification_document', document)
  return apiClient.postForm('/auth/register/recruiter', formData, {
    authenticated: false,
    errorMessages: {
      409: 'An account with this email already exists.',
      413: 'The verification document must be 10 MB or smaller.',
      422: 'Please provide valid company information and a PDF, JPG, JPEG, or PNG verification document.',
    },
  })
}

export async function changePassword({ current_password, new_password }) {
  return apiClient.post('/auth/change-password', { current_password, new_password }, {
    errorMessages: { 400: 'Your current password is incorrect.' },
  })
}
