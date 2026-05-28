import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxyTarget = process.env.VITE_PROXY_API_TARGET?.trim() || 'http://127.0.0.1:8787'

function includesAny(value: string, fragments: string[]): boolean {
  return fragments.some(fragment => value.includes(fragment))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'vendor-pdfjs'
          }
          if (includesAny(id, [
            'node_modules/@react-pdf/pdfkit',
            'node_modules/@react-pdf/png-js',
            'node_modules/@react-pdf/font',
            'node_modules/@react-pdf/image',
            'node_modules/fontkit',
            'node_modules/fontverter',
            'node_modules/restructure',
            'node_modules/brotli',
            'node_modules/unicode-properties',
            'node_modules/linebreak',
            'node_modules/jay-peg',
            'node_modules/png-js',
            'node_modules/jpeg-exif',
            'node_modules/crypto-js',
          ])) {
            return 'vendor-react-pdf-document'
          }
          if (id.includes('node_modules/@react-pdf')) {
            return 'vendor-react-pdf-runtime'
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/dexie')) {
            return 'vendor-state'
          }
          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
