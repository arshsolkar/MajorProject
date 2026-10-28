import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  clearAuthSession,
  getCurrentUser,
  getStoredAuthSession,
  storeAuthSession,
} from '../lib/authApi'
import { AUTH_SESSION_EXPIRED } from './authEvents'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    function endSession() {
      setToken(null)
      setUser(null)
      setIsInitializing(false)
      setAuthError('Your session could not be verified. Please sign in again.')
      navigate('/login', { replace: true })
    }

    window.addEventListener(AUTH_SESSION_EXPIRED, endSession)
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED, endSession)
  }, [navigate])

  useEffect(() => {
    let isActive = true
    const storedToken = getStoredAuthSession()

    async function initializeSession() {
      if (!storedToken) {
        if (isActive) setIsInitializing(false)
        return
      }

      if (isActive) setToken(storedToken)
      try {
        const currentUser = await getCurrentUser(storedToken)
        if (isActive) setUser(currentUser)
      } catch (error) {
        if (!isActive) return

        setAuthError(error instanceof Error ? error.message : 'Unable to verify your session.')
      } finally {
        if (isActive) setIsInitializing(false)
      }
    }

    initializeSession()
    return () => { isActive = false }
  }, [])

  const value = useMemo(() => ({
    token,
    user,
    isAuthenticated: Boolean(user),
    isInitializing,
    authError,
    async setAuthSession(authToken, remember) {
      storeAuthSession(authToken, remember)
      setToken(authToken)
      setUser(null)
      setAuthError(null)
      setIsInitializing(true)

      try {
        const currentUser = await getCurrentUser(authToken)
        setUser(currentUser)
        return currentUser
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Unable to verify your session.')
        throw error
      } finally {
        setIsInitializing(false)
      }
    },
    logout() {
      clearAuthSession()
      setToken(null)
      setUser(null)
      setAuthError(null)
      setIsInitializing(false)
      navigate('/login', { replace: true })
    },
  }), [authError, isInitializing, navigate, token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return context
}
