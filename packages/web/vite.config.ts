import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 32100,
    // Proxy /api to the Worker so the browser sees one origin in dev, the way production does
    // (a single Worker serving both the SPA and the API).
    proxy: {
      '/api': { target: 'http://localhost:32200', changeOrigin: true },
    },
  },
});
