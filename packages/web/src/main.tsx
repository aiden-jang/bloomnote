import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { AuthNav } from './components/AuthNav'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AuthNav />
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Register the service worker for installability and the offline shell, production only. In dev a
// cache-first worker serves stale bundles, so instead we unregister any that's lingering.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Non-fatal: the app works fine without it.
      })
    })
  } else {
    void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()))
  }
}

// Web Analytics. The token is locked to bloomnote.aidenjang.com, so anywhere else the beacon is
// CORS-refused and adds nothing but console noise.
if (import.meta.env.PROD && location.hostname === 'bloomnote.aidenjang.com') {
  const beacon = document.createElement('script')
  beacon.type = 'module'
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  beacon.setAttribute('data-cf-beacon', '{"token": "20df0a0f7a344a0a97c10191c9f2c030", "spa": true}')
  document.body.appendChild(beacon)
}
