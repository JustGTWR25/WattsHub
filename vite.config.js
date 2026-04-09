import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Expose all VITE_ prefixed env vars to the client bundle
  // Never expose non-VITE_ vars (they stay server-only)
})
