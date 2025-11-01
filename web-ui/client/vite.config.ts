import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,         // 0.0.0.0
    port: 5174,
    strictPort: false,  // will move to 5174 if 5173 busy (as you saw)
    hmr: {
      host: '192.168.1.163', // your PC’s LAN IP
      protocol: 'ws',
      port: 5174             // <- match the current Vite port
    }
  }
})