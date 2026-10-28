export const AUTH_STORAGE_KEY = 'hiresense_auth'

export function storeAuthSession(token, remember) {
  clearAuthSession()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    access_token: token.access_token,
    token_type: token.token_type,
  }))
}

export function getStoredAuthSession() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const value = storage.getItem(AUTH_STORAGE_KEY)
      if (!value) continue
      const token = JSON.parse(value)
      if (typeof token.access_token === 'string' && typeof token.token_type === 'string') return token
    } catch {
      // Ignore malformed storage values and continue checking the other storage scope.
    }
  }
  return null
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
}
