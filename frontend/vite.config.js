import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/casilleros': 'http://localhost:3001',
      '/sms': 'http://localhost:3001',
      '/webhook': 'http://localhost:3001',
      '/auditoria': 'http://localhost:3001',
      '/config': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    }
  }
})
