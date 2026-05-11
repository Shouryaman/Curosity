import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        // Must match where uvicorn listens (see root `npm run api`, default port 8000).
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        // Avoid proxy timeouts on SSE streams (`/api/runs/.../stream`).
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
})
