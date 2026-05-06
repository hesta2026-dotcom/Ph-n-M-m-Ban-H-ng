import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'https://ph-n-m-m-ban-h-ng-production-5958.up.railway.app',
      '/uploads': 'https://ph-n-m-m-ban-h-ng-production-5958.up.railway.app',
    }
  }
})
