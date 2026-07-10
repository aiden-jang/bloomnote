import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 32100,
    // Proxy the API to the bloomnote Worker (wrangler dev) in dev, so the browser treats it
    // as same-origin and matches prod (one Worker serves the SPA + the API). The Vercel-style
    // in-process apiPlugin is replaced by this once the Worker exists (step 3.2).
    proxy: {
      '/api': { target: 'http://localhost:32200', changeOrigin: true },
    },
  },
});
