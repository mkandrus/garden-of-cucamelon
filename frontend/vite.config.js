import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const FLASK_ENDPOINTS = [
  '/temperature', '/humidity', '/distance', '/pcb-temp',
  '/light', '/pump', '/photos', '/schedule',
]

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      FLASK_ENDPOINTS.map(path => [path, { target: 'http://localhost:5000', changeOrigin: true }])
    ),
  },
})
