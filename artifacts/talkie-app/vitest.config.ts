import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config dediee aux tests, separee de vite.config.ts : celle-ci embarque le
// plugin VitePWA (service worker, manifest) qui n'a aucune utilite en
// environnement de test et compliquerait inutilement le graphe de modules.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
})
