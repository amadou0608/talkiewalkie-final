import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // Tests unitaires uniquement (voir src/test/README.md pour les tests
    // d'integration necessitant une vraie base Postgres) : pas de DB reelle
    // dans cet environnement, donc pas de coverage a viser sur les
    // requetes SQL elles-memes.
    globals: false,
  },
})
