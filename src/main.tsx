import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import './index.css'

// Vercel Analytics — pageviews + custom events fired via `track()` in
// src/lib/analytics.ts. Cookie-less by design (hashes IP + UA at the
// edge), so no consent banner is required in the EU. Free tier covers
// portfolio traffic; the dashboard lives at vercel.com/<project>/analytics.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>,
)
