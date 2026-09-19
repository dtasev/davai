import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['davai.dtasev.co.uk', 'localhost', '127.0.0.1'],
    hmr: {
      clientPort: 6477,
    },
    watch: {
      usePolling: true,
    },
  },
})
