import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // Guarda la app en el celular para que abra sin internet. Los datos son
    // otra cosa: de eso se encarga src/cache.js.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono-192.png', 'icono-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // ExcelJS pesa casi un mega y solo se usa con internet: no tiene
        // sentido guardarlo en el celular del mostrador.
        globIgnores: ['**/exceljs*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Mostrador — precios',
        short_name: 'Mostrador',
        description: 'Consulta de precios de la despensa',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#fcfcfa',
        theme_color: '#124e78',
        icons: [
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173 },
})
