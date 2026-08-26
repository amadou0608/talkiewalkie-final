// Execute avant chaque fichier de test (voir vitest.config.ts,
// `setupFiles`). `env.ts` exige DATABASE_URL et JWT_SECRET des l'import
// (echec rapide en cas de configuration manquante, voir env.ts) : les tests
// unitaires n'ont pas de vraie base ni de vrai secret, mais doivent quand
// meme pouvoir importer les modules qui dependent de `env`.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/talkie_test'
process.env.JWT_SECRET ??= 'test-secret-not-for-production'
process.env.CORS_ORIGIN ??= 'http://localhost:5173'
process.env.NODE_ENV ??= 'test'
