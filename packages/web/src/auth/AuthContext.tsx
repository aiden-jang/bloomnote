import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { loginUrl, logoutUrl } from '@aidenjang/auth-client'

// Identity comes from the same-origin /api/me, never a cross-origin fetch. In dev the auth
// Worker serves login and API from one origin on :34100, so default there rather than sending
// local logins to production. VITE_AUTH_URL overrides either way.
export const AUTH_ORIGIN =
  import.meta.env.VITE_AUTH_URL ??
  (import.meta.env.DEV ? 'http://localhost:34100' : 'https://accounts.aidenjang.com')

export interface AuthUser {
  id: string
  email: string
  displayName: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  sessionError: boolean
  retrySession: () => Promise<void>
  login: (returnTo?: string) => void
  logout: (returnTo?: string) => void
  accountUrl: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState(false)
  const request = useRef<AbortController | null>(null)

  const retrySession = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setSessionError(false)
    try {
      const response = await fetch('/api/me', {
        credentials: 'include',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      })
      if (!response.ok) throw new Error('Session unavailable')
      const data = (await response.json()) as { user: AuthUser | null }
      if (request.current === controller) setUser(data.user)
    } catch {
      if (request.current === controller && !controller.signal.aborted) setSessionError(true)
    } finally {
      if (request.current === controller) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void retrySession()
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [retrySession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionError,
      retrySession,
      login: (returnTo?: string) => {
        window.location.assign(loginUrl(AUTH_ORIGIN, returnTo ?? window.location.href))
      },
      logout: (returnTo?: string) => {
        window.location.assign(logoutUrl(AUTH_ORIGIN, returnTo ?? window.location.origin))
      },
      accountUrl: new URL('/account', AUTH_ORIGIN).toString(),
    }),
    [user, loading, sessionError, retrySession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
